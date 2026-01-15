import { parse } from "jsonc-parser";
import { CheckEarthquake_DMDATA } from "../src/CheckEarthquake_DMDATA";
import * as fs from "fs";
import { Config } from "../src/config";
import { Logger } from "../src/util/logger";

describe("CheckEarthquake_DMDATA_Legacy", () => {

    let config: ReturnType<typeof Config.load>;
    let sample: any;

    const imageSend = (name: string) => {

        const groupName = "CheckEarthquake_DMDATA_Legacy";
        fs.mkdirSync(__dirname + `/../output/test/`, { recursive: true });

        return (buffer: Buffer) => {
            fs.writeFileSync(__dirname + `/../output/test/${groupName}_${name}_ImageBuffer.png`, buffer);
            return { id: "imageId" }
        }
    }

    beforeAll(() => {
        config = Config.load("./config/test.json");
        Logger.level = "info";
        config.features.enableLegacyNotice = true;

        const json = fs.readFileSync(__dirname + "/TestSample.jsonc", "utf-8");
        sample = parse(json);
    });

    test("基本動作", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("基本動作"));
        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });

    test("支援者向け", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("支援者向け"));

        // 震度を3に変更
        data.eventId = "TEST:Supporter";
        data.body.intensity.forecastMaxInt.to = "3"
        data.body.intensity.forecastMaxInt.from = "3"

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度3/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<supporterRoleId1>",
                "<supporterRoleId2>"
            ]
        );
    });

    test("訓練報", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("訓練報"));

        // 訓練報に変更
        data.status = "訓練";

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]--訓練-- /!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });

    test("試験報", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("試験報"));

        // 訓練報に変更
        data.status = "試験";

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]--訓練-- /!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });

    test("警報なし", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("警報なし"));

        // 警報を解除
        data.body.isWarning = false;

        // 対象地域を削除
        delete data.body.zones;

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]//第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });

    test("発報なし", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("発報なし"));

        // 震度を1に変更
        data.body.intensity.forecastMaxInt.to = "1"
        data.body.intensity.forecastMaxInt.from = "1"

        checkEarthquake.SendData(data, false);
        expect(mockCallback).not.toHaveBeenCalled();
    });

    test("通知済み地震で最終報でしきい値以下", () => {
        const firstData = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("通知済み地震で最終報でしきい値以下"));

        // 最初の地震で震度を4に変更
        firstData.body.intensity.forecastMaxInt.to = "4"
        firstData.body.intensity.forecastMaxInt.from = "4"

        checkEarthquake.SendData(firstData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度4/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );

        // モックをリセット
        mockCallback.mockReset();

        // 2回目
        const secondData = structuredClone(sample);

        // 2回目の地震で震度を1に変更
        secondData.body.isLastInfo = true;
        secondData.body.intensity.forecastMaxInt.to = "1"
        secondData.body.intensity.forecastMaxInt.from = "1"

        checkEarthquake.SendData(secondData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /最終報/トカラ列島近海/震度1/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });

    test("支援者向けから全体へ繰り上げ", () => {
        const firstData = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("支援者向けから全体へ繰り上げ"));

        // 最初の地震で震度を3に変更
        firstData.body.intensity.forecastMaxInt.to = "3"
        firstData.body.intensity.forecastMaxInt.from = "3"

        checkEarthquake.SendData(firstData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度3/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<supporterRoleId1>",
                "<supporterRoleId2>"
            ]
        );

        // モックをリセット
        mockCallback.mockReset();

        // 2回目
        const secondData = structuredClone(sample);

        // 2回目の地震で震度を4に変更
        secondData.body.isLastInfo = true;
        secondData.body.intensity.forecastMaxInt.to = "4"
        secondData.body.intensity.forecastMaxInt.from = "4"

        checkEarthquake.SendData(secondData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /最終報/トカラ列島近海/震度4/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            []
        );
    });



});

describe("CheckEarthquake_DMDATA", () => {

    let config: ReturnType<typeof Config.load>;
    let sample: any;

    const imageSend = (name: string) => {

        const groupName = "CheckEarthquake_DMDATA";
        fs.mkdirSync(__dirname + `/../output/test/`, { recursive: true });

        return (buffer: Buffer) => {
            fs.writeFileSync(__dirname + `/../output/test/${groupName}_${name}_ImageBuffer.png`, buffer);
            return { id: "imageId" }
        }
    }

    beforeAll(() => {
        config = Config.load("./config/test.json");
        Logger.level = "info";
        config.features.enableLegacyNotice = false;

        const json = fs.readFileSync(__dirname + "/TestSample.jsonc", "utf-8");
        sample = parse(json);
    });

    test("基本動作", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("基本動作"));
        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );
    });

    test("支援者向け", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("支援者向け"));

        // 震度を3に変更
        data.eventId = "TEST:Supporter";
        data.body.intensity.forecastMaxInt.to = "3"
        data.body.intensity.forecastMaxInt.from = "3"

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度3/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<supporterRoleId1>",
                "<supporterRoleId2>",
                "grol_9951"
            ]
        );
    });

    test("訓練報", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("訓練報"));

        // 訓練報に変更
        data.status = "訓練";

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]--訓練-- /!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );
    });

    test("試験報", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("試験報"));

        // 訓練報に変更
        data.status = "試験";

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]--訓練-- /!警報! /第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );
    });

    test("警報なし", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("警報なし"));

        // 警報を解除
        data.body.isWarning = false;

        // 対象地域を削除
        delete data.body.zones;

        checkEarthquake.SendData(data, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]//第1報/トカラ列島近海/震度5弱/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>"
            ]
        );
    });

    test("発報なし", () => {
        const data = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("発報なし"));

        // 震度を1に変更
        data.body.intensity.forecastMaxInt.to = "1"
        data.body.intensity.forecastMaxInt.from = "1"

        checkEarthquake.SendData(data, false);
        expect(mockCallback).not.toHaveBeenCalled();
    });

    test("通知済み地震で最終報でしきい値以下", () => {
        const firstData = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("通知済み地震で最終報でしきい値以下"));

        // 最初の地震で震度を4に変更
        firstData.body.intensity.forecastMaxInt.to = "4"
        firstData.body.intensity.forecastMaxInt.from = "4"

        checkEarthquake.SendData(firstData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度4/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );

        // モックをリセット
        mockCallback.mockReset();

        // 2回目
        const secondData = structuredClone(sample);

        // 2回目の地震で震度を1に変更
        secondData.body.isLastInfo = true;
        secondData.body.intensity.forecastMaxInt.to = "1"
        secondData.body.intensity.forecastMaxInt.from = "1"

        checkEarthquake.SendData(secondData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /最終報/トカラ列島近海/震度1/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );
    });

    test("支援者向けから全体へ繰り上げ", () => {
        const firstData = structuredClone(sample);
        const mockCallback = jest.fn();
        const checkEarthquake = new CheckEarthquake_DMDATA(mockCallback, imageSend("支援者向けから全体へ繰り上げ"));

        // 最初の地震で震度を3に変更
        firstData.body.intensity.forecastMaxInt.to = "3"
        firstData.body.intensity.forecastMaxInt.from = "3"

        checkEarthquake.SendData(firstData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /第1報/トカラ列島近海/震度3/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<supporterRoleId1>",
                "<supporterRoleId2>",
                "grol_9951"
            ]
        );

        // モックをリセット
        mockCallback.mockReset();

        // 2回目
        const secondData = structuredClone(sample);

        // 2回目の地震で震度を4に変更
        secondData.body.isLastInfo = true;
        secondData.body.intensity.forecastMaxInt.to = "4"
        secondData.body.intensity.forecastMaxInt.from = "4"

        checkEarthquake.SendData(secondData, false);
        expect(mockCallback).toHaveBeenCalledWith(
            "EEW",
            "[TESTCODE]/!警報! /最終報/トカラ列島近海/震度4/M5.6/深さ10km/2023年05月13日 16:10:27発生",
            false,
            [
                "<testDefaultRoleId>",
                "grol_9951"
            ]
        );
    });



});

