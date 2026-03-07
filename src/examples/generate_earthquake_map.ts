/**
 * GeoMap - 震源地を地図に描画する機能の使用例
 * 
 * このファイルを直接実行して、地図画像を生成できます:
 * yarn ts-node examples/generate_earthquake_map.ts
 */

import { GeoMap } from '../module/geomap';
import * as fs from 'fs';
import * as path from 'path';
import { EarthquakeInfo } from '../module/geomap/types';

async function main() {
    console.log('初期化中...');
    const geoMap = new GeoMap();

    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('初期化完了！\n');

    console.log('地図画像を生成しています...\n');

    // 例1: 能登半島地震（周辺ズーム）
    console.log('1. 能登半島地震の地図を生成中...');

    const notoMap = await geoMap.generateMap({
        latitude: 37.5,
        longitude: 137.2,
        magnitude: 7.6,
        intensity: "7",
        depth: 16,
        location: '石川県能登地方',
        serial: 1,
        isLast: true,
        originTime: '2024-01-01T16:10:22+09:00',
        isAlert: true,
        isTraining: true,
    }, {
        groupName: '地震情報 Beta',
        debug: false,
    });

    fs.writeFileSync(path.join(outputDir, 'noto_earthquake.png'), notoMap);
    console.log(`   ✓ 保存完了: output/noto_earthquake.png\n`);

    // 例2: 東北地方太平洋沖地震
    console.log('2. 東北地方太平洋沖地震の地図を生成中...');
    const tohokuMap = await geoMap.generateMap({
        latitude: 38.103333,
        longitude: 142.86,
        magnitude: 9.0,
        intensity: "7",
        depth: 24,
        location: '三陸沖',
        serial: 315,
        isLast: true,
        originTime: '2011-03-11T14:46:18+09:00',
        isTraining: true,
    }, {
        groupName: '地震情報 Beta',
        debug: false,
    });

    fs.writeFileSync(path.join(outputDir, 'tohoku_earthquake.png'), tohokuMap);
    console.log(`   ✓ 保存完了: output/tohoku_earthquake.png\n`);



    console.log('========================================');
    console.log('すべての地図画像の生成が完了しました！');
    console.log(`出力先: ${outputDir}`);
    console.log('========================================');
}

// スクリプトとして実行された場合のみ実行
if (require.main === module) {
    main().catch((error) => {
        console.error('エラーが発生しました:', error);
        process.exit(1);
    });
}

export { main };
