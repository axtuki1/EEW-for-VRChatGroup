/**
 * GeoMap - 震源地を地図に描画する機能の使用例
 * 
 * このファイルを直接実行して、地図画像を生成できます:
 * yarn ts-node examples/generate_earthquake_map.ts
 */

import { GeoMap } from '../src/module/geomap';
import * as fs from 'fs';
import * as path from 'path';
import { EarthquakeInfo } from '../src/module/geomap/types';

async function main() {
    console.log('初期化中...');
    const geoMap = new GeoMap({
        fontPath: path.join(__dirname, '../assets/fonts/IBMPlexSansJP-Bold.ttf'),
    });
    console.log('初期化完了！\n');

    console.log('地図画像を生成しています...\n');

    // 例1: 能登半島地震（周辺ズーム）
    console.log('1. 能登半島地震の地図を生成中（震源地周辺にズーム）...');
    const notoEarthquake: EarthquakeInfo = {
        latitude: 37.5,
        longitude: 137.2,
        magnitude: 7.6,
        intensity: "6強",
        depth: 10,
        location: '石川県能登地方',
    };
    
    const notoMap = await geoMap.generateMap(notoEarthquake, {
        debug: false,
    });

    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'noto_earthquake.png'), notoMap);
    console.log(`   ✓ 保存完了: output/noto_earthquake.png\n`);

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
