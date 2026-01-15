// 地図描画用の型定義

export interface EarthquakeInfo {
    latitude: number;    // 緯度
    longitude: number;   // 経度
    serial: number;     // 発表番号
    isLast: boolean;     // 最終報かどうか
    intensity?: "1" | "2" | "3" | "4" | "5弱" | "5強" | "6弱" | "6強" | "7";  // 震度
    magnitude?: number;  // マグニチュード
    depth?: number | "ごく浅い";      // 深さ (km)
    location?: string;   // 震源地名
    originTime?: string | Date; // 発生日時 (ISO 8601形式)
    isAlert?: boolean; // 警報・注意報が発表されているかどうか
    isTraining?: boolean; // 訓練用地震かどうか
}

export interface FontOptions {
    fontPath?: string;   // カスタムフォントファイルのパス (.ttf, .otf など)
    fontFamily?: string; // フォントファミリー名
}

export interface MapOptions {
    width?: number;      // 画像幅 (デフォルト: 800px)
    height?: number;     // 画像高さ (デフォルト: 600px)
    latOffset?: number;  // 緯度オフセット (デフォルト: 0)
    lonOffset?: number;  // 経度オフセット (デフォルト: 0)
    backgroundColor?: string; // 背景色 (デフォルト: '#E0F0FF')
    landColor?: string;  // 陸地の色 (デフォルト: '#FFFFFF')
    borderColor?: string; // 県境の色 (デフォルト: '#888888')
    epicenterBorderColor?: string; // 震源地マーカーの縁色 (デフォルト: '#FF0000')
    epicenterColor?: string; // 震源地マーカーの色 (デフォルト: '#FF0000')
    markerSize?: number; // マーカーのサイズ (デフォルト: 10)
    zoomRadius?: number; // 震源地からの表示範囲（度単位、デフォルト: 日本全体）
    infoFontFamily?: string; // 情報テキストのフォントファミリー (デフォルト: 'sans-serif')
    infoFontSize?: number;   // 情報テキストのフォントサイズ (デフォルト: 18)
    infoFontWeight?: string; // 情報テキストのフォント太さ (デフォルト: 'bold')
    infoTextColor?: string;  // 情報テキストの色 (デフォルト: '#000000')
    infoBackgroundColor?: string; // 情報テキスト背景色 (デフォルト: 'rgba(255, 255, 255, 0.85)')
    infoBorderColor?: string; // 情報テキスト境界色 (デフォルト: 'rgba(0, 0, 0, 0.85)')
    infoTextAlign?: CanvasTextAlign; // 情報テキストの揃え位置 (デフォルト: 'left')
    infoTextBaseline?: CanvasTextBaseline; // 情報テキストのベースライン (デフォルト: 'top')
    infoPosX?: number; // 情報テキストのX座標位置 (デフォルト: 20)
    infoPosY?: number; // 情報テキストのY座標位置 (デフォルト: 900)
    infoBorderSize?: number; // 情報テキスト境界の太さ (デフォルト: 4)
    infoAreaWidth?: number; // 情報テキストエリアの幅 (デフォルト: 800)
    infoAreaHeight?: number; // 情報テキストエリアの高さ (デフォルト: 100)
    groupName?: string; // 情報テキストに表示するグループ名 (デフォルト: 'GeoMap')
    debug?: boolean;    // デバッグモード (デフォルト: false)
}

export interface MapBounds {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}
