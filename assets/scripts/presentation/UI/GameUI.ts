/**
 * 游戏主界面
 * 
 * 显示玩家 HP 条、经验条、等级等基础信息
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component, _decorator, Label, ProgressBar } from 'cc';
import { World, Entity } from '@bl-framework/ecs';
import { UIManager } from './UIManager';
import { EventBus } from '../../bridge/EventBus';
import { HPComponent } from '../../gameplay/components/HP';
import { LevelExperienceComponent } from '../../gameplay/components/LevelExperience';
import { ServiceLocator } from '../../app/ServiceLocator';

const { ccclass, property } = _decorator;

/**
 * LevelUp 事件类型
 */
type LevelUpEvent = {
    type: 'LevelUp';
    handle: any;
    oldLevel: number;
    newLevel: number;
    levelsGained: number;
};

@ccclass('GameUI')
export class GameUI extends Component {
    @property(Label)
    levelLabel: Label | null = null;

    @property(ProgressBar)
    hpBar: ProgressBar | null = null;

    @property(ProgressBar)
    expBar: ProgressBar | null = null;

    private uiManager: UIManager | null = null;
    private updateTimer: number = 0;
    private readonly UPDATE_INTERVAL = 0.1; // 每 0.1 秒更新一次

    onLoad() {
        // 获取 UIManager
        this.uiManager = ServiceLocator.require(UIManager);
        this.uiManager.registerUI('GameUI', this);

        // 初始化：直接查询
        this.refreshFromWorld();

        // 监听重要事件
        const eventBus = this.uiManager?.getEventBus();
        if (eventBus) {
            eventBus.subscribe('LevelUp', this.onLevelUp.bind(this));
        }
    }

    update(dt: number) {
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

        // 更新 HP 条
        const hp = player.getComponent(HPComponent);
        if (hp && this.hpBar) {
            this.hpBar.progress = hp.cur / hp.max;
        }

        // 更新经验条和等级
        const levelExp = player.getComponent(LevelExperienceComponent);
        if (levelExp) {
            if (this.levelLabel) {
                this.levelLabel.string = `Lv.${levelExp.level}`;
            }
            if (this.expBar) {
                this.expBar.progress = levelExp.expPercentage;
            }
        }
    }

    private onLevelUp(event: LevelUpEvent) {
        // 显示升级效果
        this.showLevelUpEffect(event.newLevel);
        // 立即刷新（不需要等待定时器）
        this.refreshFromWorld();
    }

    private showLevelUpEffect(level: number): void {
        // 显示升级特效（可选）
        console.log(`[GameUI] Level Up! New Level: ${level}`);
    }

    /**
     * 打开背包按钮点击
     */
    onOpenInventoryClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:open_inventory',
            data: {}
        });
    }

    /**
     * 打开技能面板按钮点击
     */
    onOpenSkillPanelClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:open_skill_panel',
            data: {}
        });
    }

    /**
     * 打开属性面板按钮点击
     */
    onOpenStatsPanelClick() {
        const eventBus = this.uiManager?.getEventBus();
        eventBus?.push({
            type: 'UIEvent',
            eventName: 'ui:open_stats_panel',
            data: {}
        });
    }
}
