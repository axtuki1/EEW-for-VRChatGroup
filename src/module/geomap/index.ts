// 地図生成モジュール
import { createCanvas, CanvasRenderingContext2D, registerFont, Canvas, Image } from 'canvas';
import * as sharp from 'sharp';
import { EarthquakeInfo, MapOptions, MapBounds, FontOptions } from './types';
import * as fs from 'fs';
import path = require('path');

/**
 * 震源地を地図に描画するクラス
 */
export class GeoMap {
    private defaultOptions: Required<MapOptions> = {
        width: 1920,
        height: 1080,
        latOffset: -0.05,
        lonOffset: -1.5,
        backgroundColor: '#18222bff',
        landColor: '#172665ff',
        borderColor: '#abababff',
        epicenterBorderColor: '#FFc822',
        epicenterColor: '#FF2222',
        markerSize: 35,
        zoomRadius: 1.5,
        infoFontFamily: 'sans-serif',
        infoFontSize: 18,
        infoFontWeight: 'bold',
        infoTextColor: '#000000',
        infoBackgroundColor: 'rgba(0, 0, 0, 1)',
        infoBorderColor: 'rgba(101, 101, 242, 1)',
        infoTextAlign: 'left',
        infoTextBaseline: 'top',
        infoPosX: 0,
        infoPosY: 200,
        infoBorderSize: 12,
        infoAreaWidth: 800,
        infoAreaHeight: 600,
        debug: false,
    };

    // 日本地図の境界（北海道から沖縄まで）
    private japanBounds: MapBounds = {
        minLat: 24.0,  // 最南端（沖縄）
        maxLat: 45.5,  // 最北端（北海道）
        minLon: 122.0, // 最西端
        maxLon: 146.0, // 最東端
    };

    private readonly intencityColors: { [key: string]: { bgColor: string; fontColor: string } } = {
        "1": {
            bgColor: "rgba(242,242,255, 1)",
            fontColor: "rgba(0,0,0, 1)"
        },
        "2": {
            bgColor: "rgba(0,170,255, 1)",
            fontColor: "rgba(255,255,255, 1)"
        },
        "3": {
            bgColor: "rgba(0,65,255, 1)",
            fontColor: "rgba(255,255,255, 1)"
        },
        "4": {
            bgColor: "rgba(250,230,150, 1)",
            fontColor: "rgba(0,0,0, 1)"
        },
        "5弱": {
            bgColor: "rgba(255,230,0, 1)",
            fontColor: "rgba(0,0,0, 1)"
        },
        "5強": {
            bgColor: "rgba(255,153,0, 1)",
            fontColor: "rgba(0,0,0, 1)"
        },
        "6弱": {
            bgColor: "rgba(255,40,0 , 1)",
            fontColor: "rgba(255,255,255, 1)"
        },
        "6強": {
            bgColor: "rgba(165,0,33, 1)",
            fontColor: "rgba(255,255,255, 1)"
        },
        "7": {
            bgColor: "rgba(180 ,0 ,104, 1)",
            fontColor: "rgba(255,255,255, 1)"
        },
    };

    // GeoJSONデータのキャッシュ
    private cachedGeoJSON: any = null;

    private canvas: Canvas = null;
    private ctx: CanvasRenderingContext2D = null;

    private logoImage: Image = null;

    constructor(fontOption?: FontOptions) {
        // カスタムフォントの登録
        fontOption = fontOption || { fontPath: path.join(__dirname, '../../../assets/fonts/IBMPlexSansJP-Bold.ttf') };
        if (fs.existsSync(fontOption.fontPath)) {
            registerFont(fontOption.fontPath, { family: 'custom' });
            // フォントを使用するために一度描画しておく
            // Canvasライブラリを事前初期化（ネイティブモジュールの読み込み）
            this.canvas = createCanvas(1, 1);
            this.ctx = this.canvas.getContext('2d');
            this.ctx.font = `16px "custom"`;
            this.ctx.fillText('.', 0, 0);
        } else {
            // Canvasライブラリを事前初期化（ネイティブモジュールの読み込み）
            this.canvas = createCanvas(1, 1);
            this.ctx = this.canvas.getContext('2d');
        }

        // sharpの初期化
        sharp.cache(false);

        // GeoJSONデータを事前読み込み
        this.loadGeoJSON();

        this.logoImage = new Image();
        const logoImagePath = path.join(__dirname, '../../../assets/logo.png');
        this.logoImage.src = fs.readFileSync(logoImagePath);
    }

    /**
     * GeoJSONデータを読み込み（キャッシュ付き）
     */
    private loadGeoJSON(): any {
        if (this.cachedGeoJSON) {
            return this.cachedGeoJSON;
        }

        // require.resolveでnode_modules内の正しいパスを取得
        const geojsonPath = require.resolve('open-data-jp-prefectures-geojson/output/prefectures.geojson');
        const geojsonData = fs.readFileSync(geojsonPath, 'utf-8');
        this.cachedGeoJSON = JSON.parse(geojsonData);

        return this.cachedGeoJSON;
    }

    /**
     * 震源地を地図に描画し、PNG画像をBufferとして返す
     * @param earthquakeInfo 震源地情報
     * @param options 地図オプション
     * @returns PNG画像のBuffer
     */
    public async generateMap(
        earthquakeInfo: EarthquakeInfo,
        options: MapOptions = {}
    ): Promise<Buffer> {
        const opts = { ...this.defaultOptions, ...options };

        // canvasのサイズ
        this.canvas.width = opts.width;
        this.canvas.height = opts.height;
        this.ctx.clearRect(0, 0, opts.width, opts.height);

        // 背景を描画
        this.ctx.fillStyle = opts.backgroundColor;
        this.ctx.fillRect(0, 0, opts.width, opts.height);

        // 表示範囲を計算（ズーム機能）
        const bounds = this.calculateBounds(earthquakeInfo, opts.zoomRadius, opts.width, opts.height, opts);

        // 日本列島を描画
        this.drawJapan(this.ctx, opts, bounds);

        // 震源地をマーク
        this.drawEpicenter(this.ctx, earthquakeInfo, opts, bounds);

        // 情報テキストを描画
        this.drawInfo(this.ctx, earthquakeInfo, opts);

        // CanvasをPNG Bufferに変換
        const buffer = this.canvas.toBuffer('image/png');
        // Sharpで最終調整
        return await sharp(buffer)
            .png({ compressionLevel: 9 })
            .toBuffer();
    }

    /**
     * 表示範囲を計算（ズーム機能）
     * 画像の縦横比を考慮して、地理的な比率を維持
     */
    private calculateBounds(
        earthquakeInfo: EarthquakeInfo,
        zoomRadius: number,
        width: number,
        height: number,
        opts: Required<MapOptions>
    ): MapBounds {
        if (zoomRadius <= 0) {
            // デフォルト: 日本全体
            return this.japanBounds;
        }

        // 画像のアスペクト比を取得
        const aspectRatio = width / height;

        // オフセットを適用した中心座標を計算
        const centerLat = earthquakeInfo.latitude + opts.latOffset;
        const centerLon = earthquakeInfo.longitude + opts.lonOffset;

        // 緯度による経度の補正係数（日本付近の緯度での概算）
        // cos(latitude) を使って経度1度あたりの実際の距離を補正
        const latCos = Math.cos(centerLat * Math.PI / 180);

        // 緯度方向の範囲
        const latRange = zoomRadius;

        // 経度方向の範囲を画像の縦横比と緯度補正を考慮して計算
        const lonRange = (zoomRadius * aspectRatio) / latCos;

        // オフセット適用後の中心座標を基準にズーム
        return {
            minLat: centerLat - latRange,
            maxLat: centerLat + latRange,
            minLon: centerLon - lonRange,
            maxLon: centerLon + lonRange,
        };
    }

    /**
     * 日本地図を描画（GeoJSONデータを使用）
     */
    private drawJapan(ctx: CanvasRenderingContext2D, opts: Required<MapOptions>, bounds: MapBounds): void {
        ctx.fillStyle = opts.landColor;
        ctx.strokeStyle = opts.borderColor;
        ctx.lineWidth = 1;

        // キャッシュされたGeoJSONデータを使用
        const geojson = this.cachedGeoJSON;

        if (geojson && geojson.features) {
            for (const feature of geojson.features) {
                this.drawGeoJSONFeature(ctx, feature, opts, bounds);
            }
        }
    }

    /**
     * GeoJSON Featureを描画
     */
    private drawGeoJSONFeature(
        ctx: CanvasRenderingContext2D,
        feature: any,
        opts: Required<MapOptions>,
        bounds: MapBounds
    ): void {
        const geometry = feature.geometry;

        if (!geometry) return;

        if (geometry.type === 'Polygon') {
            this.drawPolygon(ctx, geometry.coordinates, opts, bounds);
        } else if (geometry.type === 'MultiPolygon') {
            for (const polygon of geometry.coordinates) {
                this.drawPolygon(ctx, polygon, opts, bounds);
            }
        }
    }

    /**
     * ポリゴンを描画
     */
    private drawPolygon(
        ctx: CanvasRenderingContext2D,
        coordinates: any[],
        opts: Required<MapOptions>,
        bounds: MapBounds
    ): void {
        for (const ring of coordinates) {
            ctx.beginPath();
            let first = true;

            for (const [lon, lat] of ring) {
                const { x, y } = this.latLonToPixel(lat, lon, opts.width, opts.height, bounds);

                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * 震源地マーカーを描画
     */
    private drawEpicenter(
        ctx: CanvasRenderingContext2D,
        info: EarthquakeInfo,
        opts: Required<MapOptions>,
        bounds: MapBounds
    ): void {
        // マーカーは元の震源地位置に描画
        const { x, y } = this.latLonToPixel(info.latitude, info.longitude, opts.width, opts.height, bounds);

        // 中心の×印
        ctx.strokeStyle = opts.epicenterBorderColor;
        ctx.lineWidth = opts.markerSize * 0.6;
        ctx.beginPath();
        // 左上
        ctx.moveTo(x - opts.markerSize * 0.8, y - opts.markerSize * 0.8);
        ctx.lineTo(x + opts.markerSize * 0.8, y + opts.markerSize * 0.8);
        // 右上
        ctx.moveTo(x + opts.markerSize * 0.8, y - opts.markerSize * 0.8);
        ctx.lineTo(x - opts.markerSize * 0.8, y + opts.markerSize * 0.8);
        ctx.stroke();

        ctx.strokeStyle = opts.epicenterColor;
        ctx.lineWidth = opts.markerSize * 0.35;
        ctx.beginPath();
        // 左上
        ctx.moveTo(x - opts.markerSize * 0.7, y - opts.markerSize * 0.7);
        ctx.lineTo(x + opts.markerSize * 0.7, y + opts.markerSize * 0.7);
        // 右上
        ctx.moveTo(x + opts.markerSize * 0.7, y - opts.markerSize * 0.7);
        ctx.lineTo(x - opts.markerSize * 0.7, y + opts.markerSize * 0.7);
        ctx.stroke();
    }

    /**
     * 地震情報テキストを描画
     */
    private drawInfo(
        ctx: CanvasRenderingContext2D,
        info: EarthquakeInfo,
        opts: Required<MapOptions>
    ): void {
        // テキストデータを準備（ラベルと値を分離）
        const textData: Array<{
            label: string;
            x: number;
            y: number;
            color?: string;
            size?: number;
            align?: CanvasTextAlign;
            baseline?: CanvasTextBaseline;
            lineHeight?: number;
            maxWidth?: number;
        }> = [];

        // テキストボーダー
        ctx.fillStyle = opts.infoBorderColor;
        ctx.fillRect(
            opts.infoPosX - opts.infoBorderSize, opts.infoPosY - opts.infoBorderSize,
            opts.infoAreaWidth + opts.infoBorderSize * 2, opts.infoAreaHeight + opts.infoBorderSize * 2
        );

        // テキスト背景
        ctx.fillStyle = opts.infoBackgroundColor;
        ctx.fillRect(
            opts.infoPosX, opts.infoPosY,
            opts.infoAreaWidth, opts.infoAreaHeight
        );

        // yyyy/MM/dd HH:mm:ss 形式の日時
        // 作成日時
        const date = new Date();
        const formattedDate = `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
        textData.push({
            label: `VRChatグループ「災害情報室」 /  ${formattedDate} 作成`,
            x: 20,
            y: 20,
            color: '#ffffff6d',
        });

        // ディスクレーマー
        textData.push({
            label:
                `地震発生直後は仕様上、画像と投稿本文とで表示内容に異なる場合があり、\n` +
                `その場合は発表番号（第n報）が大きい方が最新の情報となります。\n` +
                `本画像はdmdata.jpより受信した情報に基づき生成しています。\n` +
                `VRChatグループ「災害情報室」では予報業務の許可を受けていないため、正確な情報は気象庁発表の情報をご確認ください。`,
            x: this.canvas.width - 5,
            y: this.canvas.height - 5,
            color: '#ffffffb8',
            size: opts.infoFontSize * 1.2,
            align: 'right',
            baseline: 'bottom',
        });

        // Serial
        textData.push({
            label: `［${info.isLast ? '最終' : '第' + info.serial}報］`,
            x: opts.infoAreaWidth - 35,
            y: opts.infoPosY + 30,
            color: '#bdbdbd',
            size: opts.infoFontSize * 1.75,
            align: 'right',
            baseline: 'top',
        });

        // 地震の強さヘッダ
        this.drawHeader(
            ctx,
            'rgba(58, 58, 137, 1)',
            opts.infoPosX,
            opts.infoPosY + 30,
            360,
            50,
            0, 0, 50, 0
        )

        ctx.save();
        // 震度背景
        ctx.fillStyle = this.intencityColors[info.intensity]?.bgColor || 'rgba(200, 200, 200, 1)';
        ctx.beginPath();
        ctx.roundRect(
            opts.infoPosX + 30,
            opts.infoPosY + 100,
            330,
            135,
            25
        );
        ctx.fill();
        ctx.restore();

        textData.push({
            label: `地震の強さ/規模`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 35,
            color: '#bdbdbd',
            size: opts.infoFontSize * 1.75,
            align: 'left',
            baseline: 'top',
        });

        // 推定震度 label
        textData.push({
            label: `震度`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 230,
            color: this.intencityColors[info.intensity]?.fontColor || '#000000',
            size: opts.infoFontSize * 3,
            align: 'left',
            baseline: 'bottom',
        });

        // 推定震度 value
        textData.push({
            label: `${info.intensity || '不明'}`,
            x: opts.infoPosX + 260,
            y: opts.infoPosY + 100,
            color: this.intencityColors[info.intensity]?.fontColor || '#000000',
            size: opts.infoFontSize * 5.5,
            align: 'center',
        });

        // マグニチュード label
        textData.push({
            label: `M`,
            x: opts.infoPosX + 410,
            y: opts.infoPosY + 230,
            color: '#EEEEEE',
            size: opts.infoFontSize * 3,
            align: 'left',
            baseline: 'bottom',
        });
        // 推定震度 value
        textData.push({
            label: `${info.magnitude.toFixed(1) || '不明'}`,
            x: opts.infoPosX + 630,
            y: opts.infoPosY + 100,
            color: '#EEEEEE',
            size: opts.infoFontSize * 5.5,
            align: 'right',
        });

        // 震源地 ヘッダ
        this.drawHeader(
            ctx,
            'rgba(58, 58, 137, 1)',
            opts.infoPosX,
            opts.infoPosY + 271,
            220,
            50,
            0, 0, 50, 0
        );

        textData.push({
            label: `震源地`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 275,
            color: '#bdbdbd',
            size: opts.infoFontSize * 1.75,
            align: 'left',
            baseline: 'top',
        });

        // 震源地 value
        textData.push({
            label: `${info.location || '不明'}`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 325,
            size: opts.infoFontSize * 3.75,
            color: '#EEEEEE',
            maxWidth: 700
        });

        // 深さ ヘッダ
        this.drawHeader(
            ctx,
            'rgba(58, 58, 137, 1)',
            opts.infoPosX,
            opts.infoPosY + 440,
            280,
            50,
            0, 0, 50, 0
        );

        textData.push({
            label: `深さ`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 443,
            color: '#bdbdbd',
            size: opts.infoFontSize * 1.75,
            align: 'left',
            baseline: 'top',
        });

        // 深さ value (date)
        textData.push({
            label: `${info.depth !== undefined ? (typeof info.depth === 'number' ? `${info.depth} km` : info.depth) : '不明'}`,
            x: opts.infoPosX + 50,
            y: opts.infoPosY + 495,
            size: opts.infoFontSize * 3.75,
            color: '#EEEEEE',
        });

        const originDate_date = info.originTime ? new Date(info.originTime) : null;
        const formattedOriginDate_date = originDate_date ? `${originDate_date.getFullYear()}年${('0' + (originDate_date.getMonth() + 1)).slice(-2)}月${('0' + originDate_date.getDate()).slice(-2)}日` : '不明';
        const formattedOriginDate_time = originDate_date ? `${('0' + originDate_date.getHours()).slice(-2)}:${('0' + originDate_date.getMinutes()).slice(-2)}:${('0' + originDate_date.getSeconds()).slice(-2)}` : '不明';

        textData.push({
            label: `${formattedOriginDate_date} ${formattedOriginDate_time} 発生`,
            x: opts.infoPosX + opts.infoAreaWidth - 10,
            y: opts.infoPosY + opts.infoAreaHeight - 10,
            color: '#bdbdbd',
            size: opts.infoFontSize * 1.25,
            align: 'right',
            baseline: 'bottom',
        });

        // ロゴ
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(
            this.logoImage,
            0, 0, this.logoImage.width, this.logoImage.height,
            this.canvas.width - (this.logoImage.width * 0.18) + 50,
            0,
            this.logoImage.width * 0.18,
            this.logoImage.height * 0.18
        );
        ctx.fillStyle = 'rgb(219, 24, 32)';
        ctx.fillRect(
            0,
            this.logoImage.height * 0.18 - 29.5,
            this.canvas.width - (this.logoImage.width * 0.18) + 0.1 + 50,
            5
        );
        ctx.restore();


        // テキスト描画設定
        ctx.textAlign = opts.infoTextAlign;
        ctx.textBaseline = opts.infoTextBaseline;

        textData.forEach((data, i) => {
            this.drawText(ctx, data, opts);
        });
    }

    /**
     * テキストを描画（改行、maxWidth、align、baselineに対応）
     */
    private drawText(
        ctx: CanvasRenderingContext2D,
        data: {
            label: string;
            x: number;
            y: number;
            color?: string;
            size?: number;
            align?: CanvasTextAlign;
            baseline?: CanvasTextBaseline;
            lineHeight?: number;
            maxWidth?: number;
        },
        opts: Required<MapOptions>
    ): void {
        ctx.fillStyle = data.color || opts.infoTextColor;

        // 位置確認用の十字マーカー（X,Y交点を表示）
        if (opts.debug) {
            ctx.save();
            ctx.strokeStyle = '#ff6f61';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(data.x - 10, data.y);
            ctx.lineTo(data.x + 10, data.y);
            ctx.moveTo(data.x, data.y - 10);
            ctx.lineTo(data.x, data.y + 10);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = data.color || opts.infoTextColor;

        let fontSize = opts.infoFontSize;
        if (data.size) {
            fontSize = data.size;
        }
        const align = data.align || opts.infoTextAlign;
        // 揃えは手動で補正するので描画時はleftに固定
        ctx.textAlign = 'left';
        ctx.textBaseline = data.baseline || opts.infoTextBaseline;
        ctx.font = `${fontSize}px "custom"`;

        // 改行でテキストを分割
        const lines = data.label.split('\n');
        const lineHeight = data.lineHeight ? fontSize * data.lineHeight : fontSize * 1.2; // 行の高さ
        const baseline = data.baseline || opts.infoTextBaseline;

        // baselineに応じてY座標の基準点を調整
        let baselineOffsetY = 0;
        if (baseline === 'bottom' || baseline === 'ideographic' || baseline === 'alphabetic') {
            // bottom系: 最後の行をdata.yに配置し、上にさかのぼる
            baselineOffsetY = (lines.length - 1) * lineHeight;
        } else if (baseline === 'middle') {
            // middle: テキスト全体の中央をdata.yに配置
            baselineOffsetY = ((lines.length - 1) * lineHeight) / 2;
        }
        // 'top' はoffsetなし

        lines.forEach((line, lineIndex) => {
            const currentY = data.y - baselineOffsetY + (lineHeight * lineIndex);

            // 行全体の幅を事前に計算
            const parts = line.split(/([A-Za-z0-9\s:°\.]+)/);
            const totalWidth = parts.reduce((sum, part) => sum + ctx.measureText(part).width, 0);

            // 圧縮率を計算
            let scaleX = 1;
            let displayWidth = totalWidth;
            if (data.maxWidth && totalWidth > data.maxWidth) {
                scaleX = data.maxWidth / totalWidth;
                displayWidth = data.maxWidth;
            }

            let startX = data.x;
            if (align === 'center') {
                startX -= displayWidth / 2;
            } else if (align === 'right' || align === 'end') {
                startX -= displayWidth;
            }

            // デバッグモード: テキストのバウンディングボックスを表示
            if (opts.debug) {
                ctx.save();
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                // baselineに応じてバウンディングボックスのY座標を調整
                let boxY = currentY;
                let boxHeight = lineHeight;
                if (baseline === 'top' || baseline === 'hanging') {
                    // topの場合はcurrentYから下に伸びる
                    boxY = currentY;
                } else if (baseline === 'bottom' || baseline === 'ideographic' || baseline === 'alphabetic') {
                    // bottomの場合はcurrentYから上に伸びる
                    boxY = currentY - lineHeight;
                } else if (baseline === 'middle') {
                    // middleの場合はcurrentYを中心に上下に伸びる
                    boxY = currentY - lineHeight / 2;
                }
                ctx.strokeRect(startX, boxY, displayWidth, boxHeight);
                ctx.restore();
            }

            // 各パーツを描画
            let currentX = startX;
            parts.forEach((part) => {
                if (!part) return;

                const isLatin = /^[A-Za-z0-9\s:°\.]+$/.test(part);
                const yOffset = isLatin ? fontSize * 0.025 : 0;
                const partWidth = ctx.measureText(part).width;

                // fillTextのmaxWidthパラメータを使用して圧縮
                if (scaleX < 1) {
                    const partMaxWidth = partWidth * scaleX;
                    ctx.fillText(part, currentX, currentY + yOffset, partMaxWidth);
                    currentX += partMaxWidth;
                } else {
                    ctx.fillText(part, currentX, currentY + yOffset);
                    currentX += partWidth;
                }
            });
        });
    }

    private drawHeader(
        ctx: CanvasRenderingContext2D,
        color: string,
        x: number,
        y: number,
        width: number,
        height: number,
        leftUpperOffset: number = 0,
        leftLowerOffset: number = 0,
        rightUpperOffset: number = 0,
        rightLowerOffset: number = 0,
    ) {
        ctx.save();
        // ヘッダー背景
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + leftUpperOffset, y);
        ctx.lineTo(x + width - rightUpperOffset, y);
        ctx.lineTo(x + width - rightLowerOffset, y + height);
        ctx.lineTo(x + leftLowerOffset, y + height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 緯度経度をピクセル座標に変換
     */
    private latLonToPixel(
        lat: number,
        lon: number,
        width: number,
        height: number,
        bounds: MapBounds
    ): { x: number; y: number } {
        const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
        const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;

        return { x, y };
    }
}