
/**
 * 津波に関する電文インターフェース
 */
export interface TsunamiAlert {
    /**
     * 現象毎に割り振られたイベントID
     */
    eventId: string;
    /**
     * 現象毎に割り振られた発表番号
     */
    serialNo: number | null;
    /**
     * タイトル
     */
    title: string;
    /**
     * 情報の運用状態
     * "通常"以外を本番運用で使用しないこと
     */
    status: "通常" | "訓練" | "試験";
    /**
     * 津波警報・注意報・予報に関する情報配列
     */
    forecasts: TsunamiForecast[];
    /**
     * 取消時の理由や、その他の追記事項がある場合、自由形式で記載
     */
    text?: string;
    /**
     * 付加的な情報を文章形式で記載
     */
    comments?: {
        /**
         * その他の付加的な情報を自由形式で記載
         */
        free?: string;
        warning?: {
            /**
             * 固定付加文の本文
             */
            text: string;
            /**
             * 固定付加文コード群
             */
            codes: string[];
        }
    }
}

/**
 * 津波警報・注意報・予報の情報インターフェース
 */
export interface TsunamiForecast {
    /**
     * 津波予報区コード
     * 気象庁防災情報XMLフォーマット - コード表 - 地震火山関連コード表、
     * 「31」AreaTsunami コード表を参照。
     */
    code: string;
    /**
     * コードに紐づく 津波予報区名
     */
    name: string;
    /**
     * 津波警報等の種別
     */
    kind: TsunamiForecastKind;
    /**
     * 津波予報区に対する津波の到達予想時刻
     * 若干の海面変動の場合は出現しない
     */
    firstHeight?: TsunamiFirstHeight;
    /**
     * 津波予報区に対する津波の予測高さ
     * 津波注意報以上を解除後、
     * 海面変動が継続する場合には出現しない
     */
    maxHeight?: TsunamiMaxHeight;
}

/**
 * 津波警報等の種別インターフェース
 */
export interface TsunamiForecastKind {
    /**
     * 津波の種類コード
     * 気象庁防災情報XMLフォーマット - コード表 - 地震火山関連コード表、
     * 「14」TsunamiWarning コード表を参照。
     */
    code: string;
    /**
     * コードに紐づく 警報等情報要素／津波警報・注意報・予報
     */
    name: string;
    /**
     * 前回発表した津波警報等の種別
     * このアイテムがlastKind内の場合は存在しない。(ネストは1レベルまで)
     * 初回発表時は「00:津波なし」。
     */
    lastKind?: TsunamiForecastKind;
}

export interface TsunamiFirstHeight {
    /**
     * 津波の到達予想時刻（ISO 8601形式/日本時間）
     * 未到達、到達していないと推測される場合に設定
     */
    arrivalTime?: string;
    /**
     * すでに津波が到達している場合や、推測される場合、
     * 直ちに津波が来襲されると予想される場合に出現
     */
    condition?: "津波到達中と推測" | "第１波の到達を確認" | "ただちに津波来襲と予測";
    /**
     * "続報によって追加された予報区である場合"か、
     * "到達予想時刻が更新された場合"に設定される値
     */
    revise?: "追加" | "更新";
}

export interface TsunamiMaxHeight {
    height: {
        /**
         * 数値情報の種類。固定値
         */
        type: "津波の高さ";
        /**
         * 数値情報の単位。固定値
         */
        unit: "m";
        /**
         * 津波の予想される高さ。
         * 定性的表現(conditionの利用)をする場合は Null とする
         */
        value: string | null;
        /**
         * 数値情報(value)を上回る場合に出現
         * 10m超となるときに出現し、数値情報を補助する
         */
        over?: true;
        /**
         * 津波の高さを定性的表現する場合に出現
         * 津波注意報時は出現しない
         */
        condition?: "高い" | "巨大";
    }

}