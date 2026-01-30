import { Entity, World } from "@bl-framework/ecs";
import { SceneTagComponent } from "../gameplay/components";
/**
 * 场景类型枚举
 */
export enum SceneType {
    Main = 'main',
    Battle = 'battle',
    Shop = 'shop',
    Boss = 'boss'
}

export class SceneContext {
    constructor(public world: World, public sceneType: SceneType) { }

    createEntity(): Entity {
        const e = this.world.createEntity();
        e.addComponent(SceneTagComponent);
        e.getComponent(SceneTagComponent)!.sceneType = this.sceneType;
        return e;
    }
}
