import { director } from "cc";
import { SceneType } from "./SceneContext";

export interface EngineSceneLoader {
    load(sceneType: SceneType): Promise<void>;
}

export class CocosSceneLoader implements EngineSceneLoader {
    constructor(private readonly getSceneName: (t: SceneType) => string) { }

    load(sceneType: SceneType): Promise<void> {
        const name = this.getSceneName(sceneType);
        return new Promise((resolve, reject) => {
            director.loadScene(name, (err) => (err ? reject(err) : resolve()));
        });
    }
}
