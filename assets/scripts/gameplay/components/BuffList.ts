/**
 * Buff 列表组件
 * 
 * 存储实体的 Buff 效果列表
 * 
 * 设计决策：使用对象字典（Record）存储 Buff，通过 stacks 支持堆叠
 * 参考文档：memory-bank/creative/creative-buff-list.md
 */

import { Component, component } from '@bl-framework/ecs';

/**
 * Buff 数据
 */
export interface BuffData {
    /** 唯一 ID（用于区分同类型的不同 Buff） */
    id: string;
    /** Buff 类型（如 "damage_boost", "speed_boost", "dot"） */
    type: string;
    /** 剩余时间（秒） */
    duration: number;
    /** 堆叠层数（默认 1） */
    stacks: number;
    /** 参数（如 { value: 0.2 } 表示 20% 加成） */
    params: Record<string, any>;
    /** 来源（可选，如技能 ID） */
    source?: string;
}

@component({ name: 'BuffList', pooled: true, poolSize: 50 })
export class BuffListComponent extends Component {
    /** Buff 字典：type -> BuffData */
    buffs: Record<string, BuffData> = {};

    /**
     * 添加 Buff
     * @param buffId 唯一 ID
     * @param type Buff 类型
     * @param duration 持续时间（秒）
     * @param stacks 堆叠层数（默认 1）
     * @param params 参数
     * @param source 来源（可选）
     */
    addBuff(
        buffId: string,
        type: string,
        duration: number,
        stacks: number = 1,
        params?: Record<string, any>,
        source?: string
    ): void {
        if (this.buffs[type]) {
            // 堆叠
            this.buffs[type].stacks += stacks;
            this.buffs[type].duration = Math.max(this.buffs[type].duration, duration);
            // 更新参数（如果提供）
            if (params) {
                Object.assign(this.buffs[type].params, params);
            }
            if (source) {
                this.buffs[type].source = source;
            }
        } else {
            // 新增
            this.buffs[type] = {
                id: buffId,
                type,
                duration,
                stacks,
                params: params || {},
                source
            };
        }
    }

    /**
     * 移除 Buff
     * @param type Buff 类型
     */
    removeBuff(type: string): void {
        delete this.buffs[type];
    }

    /**
     * 查找 Buff
     * @param type Buff 类型
     * @returns Buff 数据，如果不存在返回 undefined
     */
    findBuff(type: string): BuffData | undefined {
        return this.buffs[type];
    }

    /**
     * 检查是否有 Buff
     * @param type Buff 类型
     * @returns 是否存在
     */
    hasBuff(type: string): boolean {
        return this.buffs[type] !== undefined;
    }

    /**
     * 获取所有 Buff
     * @returns Buff 数组
     */
    getAllBuffs(): BuffData[] {
        return Object.keys(this.buffs).map(key => this.buffs[key]);
    }

    /**
     * 获取 Buff 数量
     * @returns Buff 数量
     */
    getCount(): number {
        return Object.keys(this.buffs).length;
    }

    reset(): void {
        super.reset();
        this.buffs = {};
    }
}
