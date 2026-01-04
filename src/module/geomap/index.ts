// 地図生成モジュール
import { createCanvas, CanvasRenderingContext2D, registerFont, Canvas } from 'canvas';
import * as sharp from 'sharp';
import { EarthquakeInfo, MapOptions, MapBounds, FontOptions } from './types';
import * as fs from 'fs';

/**
 * 震源地を地図に描画するクラス
 */
export class GeoMap {
    private defaultOptions: Required<MapOptions> = {
        width: 1920,
        height: 1080,
        latOffset: 0,
        lonOffset: -1.25,
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
        infoBackgroundColor: 'rgba(0, 0, 0, 0.85)',
        infoBorderColor: 'rgba(101, 101, 242, 0.85)',
        infoTextAlign: 'left',
        infoTextBaseline: 'top',
        infoPosX: 0,
        infoPosY: 500,
        infoBorderSize: 12,
        infoAreaWidth: 700,
        infoAreaHeight: 500,
        debug: false,
    };

    // 日本地図の境界（北海道から沖縄まで）
    private japanBounds: MapBounds = {
        minLat: 24.0,  // 最南端（沖縄）
        maxLat: 45.5,  // 最北端（北海道）
        minLon: 122.0, // 最西端
        maxLon: 146.0, // 最東端
    };

    // GeoJSONデータのキャッシュ
    private cachedGeoJSON: any = null;

    private canvas: Canvas = null;
    private ctx: CanvasRenderingContext2D = null;

    constructor(fontOption?: FontOptions) {
        // カスタムフォントの登録
        if (fontOption && fs.existsSync(fontOption.fontPath)) {
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
        }> = [];

        // yyyy/MM/dd HH:mm:ss 形式の日時
        // 作成日時
        const date = new Date();
        const formattedDate = `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
        textData.push({
            label: `画像作成日時: ${formattedDate}`,
            x: 20,
            y: 35,
            color: '#ffffff6d',
        });

        // 推定震度 label
        textData.push({
            label: `震度`,
            x: 40,
            y: opts.infoPosY + 140,
            color: '#EEEEEE',
            size: opts.infoFontSize * 3,
            align: 'left',
            baseline: 'bottom',
        });
        // 推定震度 value
        textData.push({
            label: `${info.intensity || '不明'}`,
            x: 330,
            y: opts.infoPosY + 10,
            color: '#EEEEEE',
            size: opts.infoFontSize * 5.5,
            align: 'right',
        });

        // マグニチュード label
        textData.push({
            label: `M`,
            x: 400,
            y: opts.infoPosY + 140,
            color: '#EEEEEE',
            size: opts.infoFontSize * 3,
            align: 'left',
            baseline: 'bottom',
        });
        // 推定震度 value
        textData.push({
            label: `${info.magnitude || '不明'}`,
            x: 620,
            y: opts.infoPosY + 10,
            color: '#EEEEEE',
            size: opts.infoFontSize * 5.5,
            align: 'right',
        });



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

        this.drawHeader(
            ctx,
            'rgba(199, 199, 199, 1)',
            opts.infoPosX,
            opts.infoPosY + 50,
            opts.infoAreaWidth - 100,
            50,
            0, 0, 0, 50
        )

        // テキスト描画設定
        ctx.textAlign = opts.infoTextAlign;
        ctx.textBaseline = opts.infoTextBaseline;

        textData.forEach((data, i) => {
            ctx.fillStyle = data.color || opts.infoTextColor;

            // 位置確認用の十字マーカー（X,Y交点を表示）
            if (opts.debug) {
                ctx.save();
                ctx.strokeStyle = '#ff6f61';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(data.x - 6, data.y);
                ctx.lineTo(data.x + 6, data.y);
                ctx.moveTo(data.x, data.y - 6);
                ctx.lineTo(data.x, data.y + 6);
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

            // 行全体の幅を事前に計算し、alignに応じて開始位置を補正
            const parts = data.label.split(/([A-Za-z0-9\s:°\.]+)/);
            const totalWidth = parts.reduce((sum, part) => sum + ctx.measureText(part).width, 0);

            let currentX = data.x;
            if (align === 'center') {
                currentX -= totalWidth / 2;
            } else if (align === 'right' || align === 'end') {
                currentX -= totalWidth;
            }

            parts.forEach((part) => {
                if (!part) return;

                // 欧文（英数字記号）かどうか判定
                const isLatin = /^[A-Za-z0-9\s:°\.]+$/.test(part);
                const yOffset = isLatin ? fontSize * 0.025 : 0;  // 欧文を下げる

                ctx.fillText(part, currentX, data.y + yOffset);
                currentX += ctx.measureText(part).width;
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