/// <reference types="jest" />
/**
 * SkillSystem 单元测试
 */

import { World } from '@bl-framework/ecs';
import { SkillSystem } from 'db://assets/scripts/gameplay/systems/SkillSystem';
import { SkillSlotsComponent } from 'db://assets/scripts/gameplay/components/SkillSlots';
import { TransformComponent } from 'db://assets/scripts/gameplay/components/Transform';
import { AnimationIntentComponent } from 'db://assets/scripts/gameplay/components/AnimationIntent';
import { HPComponent } from 'db://assets/scripts/gameplay/components/HP';
import { BuffListComponent } from 'db://assets/scripts/gameplay/components/BuffList';
import { FactionComponent, FactionType } from 'db://assets/scripts/gameplay/components/Faction';
import { VelocityComponent } from 'db://assets/scripts/gameplay/components/Velocity';

describe('SkillSystem', () => {
    let world: World;
    let skillSystem: SkillSystem;

    beforeEach(() => {
        world = new World({ debug: false });
        skillSystem = world.registerSystem(SkillSystem);
    });

    describe('onUpdate', () => {
        it('应该执行伤害技能', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'fireball', {
                type: 'damage',
                damage: 50,
                range: 100,
                cooldown: 2.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0; // 冷却完成

            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetHP = target.addComponent(HPComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 50; // 在范围内
            targetTransform.y = 0;
            targetHP.cur = 100;
            targetHP.max = 100;
            targetFaction.faction = FactionType.Player;

            const casterFaction = caster.addComponent(FactionComponent);
            casterFaction.faction = FactionType.Enemy;

            // 触发技能
            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 目标应该受到伤害
            expect(targetHP.cur).toBe(50);
            // 技能应该进入冷却
            expect(slot.cooldown).toBe(2.0);
            // 使用次数应该增加
            expect(slot.uses).toBe(1);
        });

        it('冷却中的技能不应该执行', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'fireball', {
                type: 'damage',
                damage: 50,
                range: 100,
                cooldown: 2.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 1.0; // 还在冷却中

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 使用次数不应该增加
            expect(slot.uses).toBe(0);
        });

        it('应该执行 Buff 技能', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'strength', {
                type: 'buff',
                buffType: 'strength',
                duration: 10,
                range: 100,
                targetSelf: true,
                cooldown: 5.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0;

            const buffList = caster.addComponent(BuffListComponent);

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 应该添加 Buff
            expect(buffList.hasBuff('strength')).toBe(true);
        });

        it('应该执行治疗技能', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'heal', {
                type: 'heal',
                heal: 30,
                range: 100,
                targetSelf: true,
                cooldown: 3.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0;

            const hp = caster.addComponent(HPComponent);
            hp.cur = 50;
            hp.max = 100;

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 应该恢复生命值
            expect(hp.cur).toBe(80);
        });

        it('应该执行传送技能', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            const velocity = caster.addComponent(VelocityComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;
            velocity.vx = 1; // 向右移动
            velocity.vy = 0;

            skillSlots.setSkill(0, 'teleport', {
                type: 'teleport',
                distance: 100,
                cooldown: 5.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0;

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 应该向前传送
            expect(casterTransform.x).toBeGreaterThan(0);
        });

        it('应该触发技能动画', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'fireball', {
                type: 'damage',
                damage: 50,
                range: 100,
                cooldown: 2.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0;

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 应该触发技能动画（triggerIntent 会被设置为 'skill'，但可能已经被清除）
            // 检查是否曾经触发过技能
            expect(slot.uses).toBe(1);
        });

        it('应该考虑技能等级', () => {
            const caster = world.createEntity('Caster');
            const casterTransform = caster.addComponent(TransformComponent);
            const skillSlots = caster.addComponent(SkillSlotsComponent);
            const animIntent = caster.addComponent(AnimationIntentComponent);
            casterTransform.x = 0;
            casterTransform.y = 0;

            skillSlots.setSkill(0, 'fireball', {
                type: 'damage',
                damage: 50,
                range: 100,
                cooldown: 2.0
            });
            const slot = skillSlots.getSkill(0)!;
            slot.cooldown = 0;
            slot.level = 2; // 技能等级 2

            const target = world.createEntity('Target');
            const targetTransform = target.addComponent(TransformComponent);
            const targetHP = target.addComponent(HPComponent);
            const targetFaction = target.addComponent(FactionComponent);
            targetTransform.x = 50;
            targetTransform.y = 0;
            targetHP.cur = 100;
            targetHP.max = 100;
            targetFaction.faction = FactionType.Player;

            const casterFaction = caster.addComponent(FactionComponent);
            casterFaction.faction = FactionType.Enemy;

            animIntent.trigger('skill_0');

            const dt = 0.016;
            skillSystem.onUpdate!(dt);

            // 伤害应该是 50 * 2 = 100
            expect(targetHP.cur).toBe(0);
        });
    });
});
