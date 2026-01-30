/**
 * 属性界面
 * 
 * 显示玩家属性（攻击、防御、速度等）
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component, _decorator, Label } from 'cc';
import { World, Entity } from '@bl-framework/ecs';
import { UIManager } from './UIManager';
import { EventBus } from '../../bridge/EventBus';
import { StatsComponent } from '../../gameplay/components/Stats';
import { ServiceLocator } from '../../app/ServiceLocator';

const { ccclass, property } = _decorator;

/**
 * EquipmentChange 事件类型
 */
type EquipmentChangeEvent = {
    type: 'EquipmentChange';
    handle: any;
    slotType: string;
    equipmentId: string;
    action: 'equip' | 'unequip';
};

@ccclass('StatsUI')
export class StatsUI extends Component {
    @property(Label)
    attackLabel: Label | null = null;

    @property(Label)
    defenseLabel: Label | null = null;

    @property(Label)
    speedLabel: Label | null = null;

    @property(Label)
    maxHPLabel: Label | null = null;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.2; // 每 0.2 秒更新一次

    onLoad() {
        this.uiManager = ServiceLocator.require(UIManager);
        this.uiManager.registerUI('StatsUI', this);
        this.node.active = false;

        // 监听装备变化事件
        const eventBus = this.uiManager?.getEventBus();
        if (eventBus) {
            eventBus.subscribe('EquipmentChange', this.onEquipmentChange.bind(this));
        }
    }

    update(dt: number) {
        if (!this.node.active) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.refreshFromWorld();
        }
    }

    private refreshFromWorld() {
        const world = this.uiManager?.getWorld();
        if (!world) return;

        // 使用 UIManager 的统一方法查找玩家
        const player = this.uiManager?.getPlayerEntity(world);
        if (!player) return;

        const stats = player.getComponent(StatsComponent);
        if (!stats) return;

        // ⚠️ 性能注意：getFinal() 可能变重（合并 buff/equipment）
        // 只在 refreshFromWorld() 中调用，不在每帧调用
        // 当前更新频率已控制为 0.2 秒，这是合理的
        if (this.attackLabel) {
            const attack = stats.getFinal('attack');
            this.attackLabel.string = `攻击: ${attack.toFixed(0)}`;
        }
        if (this.defenseLabel) {
            const defense = stats.getFinal('defense');
            this.defenseLabel.string = `防御: ${defense.toFixed(0)}`;
        }
        if (this.speedLabel) {
            const speed = stats.getFinal('speed');
            this.speedLabel.string = `速度: ${speed.toFixed(0)}`;
        }
        if (this.maxHPLabel) {
            const maxHP = stats.getFinal('maxHP');
            this.maxHPLabel.string = `最大HP: ${maxHP.toFixed(0)}`;
        }
    }

    private onEquipmentChange(event: EquipmentChangeEvent) {
        // 装备变化时立即更新
        this.refreshFromWorld();
    }

    /**
     * 显示属性面板
     */
    show() {
        this.node.active = true;
        this.refreshFromWorld();
    }

    /**
     * 隐藏属性面板
     */
    hide() {
        this.node.active = false;
    }
}
