/// <reference types="jest" />
/**
 * BuffList 组件单元测试
 */

import { World } from '@bl-framework/ecs';
import { BuffListComponent, BuffData } from 'db://assets/scripts/gameplay/components/BuffList';

describe('BuffListComponent', () => {
    let world: World;
    let entity: any;

    beforeEach(() => {
        world = new World({ debug: false });
        entity = world.createEntity('TestEntity');
    });

    describe('添加和查找 Buff', () => {
        it('应该能够添加 Buff', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            
            const buff = buffList.findBuff('damage_boost');
            expect(buff).toBeDefined();
            expect(buff?.id).toBe('buff_001');
            expect(buff?.type).toBe('damage_boost');
            expect(buff?.duration).toBe(5.0);
            expect(buff?.stacks).toBe(1);
            expect(buff?.params.value).toBe(0.2);
        });

        it('应该能够堆叠相同类型的 Buff', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            
            const buff = buffList.findBuff('damage_boost');
            expect(buff?.stacks).toBe(2);
        });

        it('应该能够查找 Buff', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            
            expect(buffList.hasBuff('damage_boost')).toBe(true);
            expect(buffList.hasBuff('speed_boost')).toBe(false);
        });

        it('应该能够获取所有 Buff', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            buffList.addBuff('buff_002', 'speed_boost', 3.0, 1, { value: 0.1 });
            
            const allBuffs = buffList.getAllBuffs();
            expect(allBuffs.length).toBe(2);
        });
    });

    describe('移除 Buff', () => {
        it('应该能够移除 Buff', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            buffList.removeBuff('damage_boost');
            
            expect(buffList.hasBuff('damage_boost')).toBe(false);
            expect(buffList.getCount()).toBe(0);
        });
    });

    describe('重置', () => {
        it('应该能够重置组件', () => {
            const buffList = world.addComponent(entity.id, BuffListComponent);
            
            buffList.addBuff('buff_001', 'damage_boost', 5.0, 1, { value: 0.2 });
            buffList.reset();
            
            expect(buffList.getCount()).toBe(0);
        });
    });
});
