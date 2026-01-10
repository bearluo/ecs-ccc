/**
 * Buff 系统
 * 
 * 管理 Buff 的持续时间和效果
 * 
 * ⚠️ 架构约束：
 * - Fixed System，不能直接操作 View 层
 * - 不能直接修改 AnimState
 */

import { System, system, Entity } from '@bl-framework/ecs';
import { BuffListComponent, BuffData } from '../components/BuffList';
import { HPComponent } from '../components/HP';
import { VelocityComponent } from '../components/Velocity';

@system({ priority: 4 })
export class BuffSystem extends System {
    onUpdate(dt: number): void {
        const query = this.world.createQuery({
            all: [BuffListComponent]
        });

        query.forEach(entity => {
            const buffList = entity.getComponent(BuffListComponent)!;

            // 更新所有 Buff 的持续时间
            const buffTypes = Object.keys(buffList.buffs);
            for (const type of buffTypes) {
                const buff = buffList.buffs[type];
                if (!buff) continue;

                // 减少持续时间
                buff.duration -= dt;

                // 如果持续时间到期，移除 Buff
                if (buff.duration <= 0) {
                    buffList.removeBuff(type);
                }
            }

            // 应用 Buff 效果（如 DOT 伤害）
            this.applyBuffEffects(entity, buffList, dt);
        });
    }

    /**
     * 应用 Buff 效果
     * @param entity 实体
     * @param buffList Buff 列表组件
     * @param dt 时间步长
     */
    private applyBuffEffects(entity: Entity, buffList: BuffListComponent, dt: number): void {
        const allBuffs = buffList.getAllBuffs();

        for (const buff of allBuffs) {
            // DOT（持续伤害）效果
            if (buff.type === 'dot' || buff.type === 'poison') {
                const hp = entity.getComponent(HPComponent);
                if (hp && !hp.isDead) {
                    const damage = (buff.params.damage || 0) * buff.stacks * dt;
                    hp.cur = Math.max(0, hp.cur - damage);
                }
            }

            // HOT（持续治疗）效果
            if (buff.type === 'hot' || buff.type === 'heal_over_time') {
                const hp = entity.getComponent(HPComponent);
                if (hp && !hp.isDead) {
                    const heal = (buff.params.heal || 0) * buff.stacks * dt;
                    hp.cur = Math.min(hp.max, hp.cur + heal);
                }
            }

            // 速度加成效果（由 MoveSystem 读取，这里只管理 Buff）
            // 实际的速度修改应该在 MoveSystem 中根据 Buff 计算
        }
    }
}
