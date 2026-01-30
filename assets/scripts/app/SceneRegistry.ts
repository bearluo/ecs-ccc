import { World } from "@bl-framework/ecs";
import { SceneContext } from "./SceneContext";

/**
 * 场景模块接口
 */
export interface SceneModule {
    preload?(ctx: SceneContext): Promise<void>;
    enter(ctx: SceneContext): Promise<void> | void;
    exit?(ctx: SceneContext): Promise<void> | void;
}
  
  
/**
 * 场景注册器
 */
export class SceneRegistry {
    private static modules: Map<string, SceneModule> = new Map();

    /**
     * 注册场景模块
     * @param sceneName 场景名称
     * @param module 场景模块
     */
    static register(sceneName: string, module: SceneModule): void {
        this.modules.set(sceneName, module);
    }

    /**
     * 获取场景模块
     * @param sceneName 场景名称
     * @returns 场景模块
     */
    static get(sceneName: string): SceneModule | undefined {
        return this.modules.get(sceneName);
    }
}