/// <reference types="jest" />
/**
 * SortedSystemList 单元测试
 */

import { World, System } from '@bl-framework/ecs';
import { SortedSystemList } from 'db://assets/scripts/bridge/SortedSystemList';

// Mock 系统
class TestSystemA extends System {
    priority = 0;
    onUpdateCalled = false;
    onUpdate(dt: number): void {
        this.onUpdateCalled = true;
    }
}

class TestSystemB extends System {
    priority = 1;
    onUpdateCalled = false;
    onUpdate(dt: number): void {
        this.onUpdateCalled = true;
    }
}

class TestSystemC extends System {
    priority = 2;
    onUpdateCalled = false;
    onUpdate(dt: number): void {
        this.onUpdateCalled = true;
    }
}

describe('SortedSystemList', () => {
    let systemList: SortedSystemList;
    let world: World;

    beforeEach(() => {
        systemList = new SortedSystemList();
        world = new World({ debug: false });
    });

    describe('add', () => {
        it('应该能够添加系统类型', () => {
            systemList.add(TestSystemA);

            expect(systemList.getCount()).toBe(1);
        });

        it('应该能够添加多个系统类型', () => {
            systemList.add(TestSystemA);
            systemList.add(TestSystemB);
            systemList.add(TestSystemC);

            expect(systemList.getCount()).toBe(3);
        });

        it('不应该重复添加相同的系统类型', () => {
            systemList.add(TestSystemA);
            systemList.add(TestSystemA);

            expect(systemList.getCount()).toBe(1);
        });

        it('添加系统后应该标记为脏', () => {
            world.registerSystem(TestSystemA);
            systemList.add(TestSystemA);

            // 第一次更新应该触发排序
            systemList.update(world, 0.016);
            const systemA = world.getSystem(TestSystemA)!;
            expect(systemA.onUpdateCalled).toBe(true);

            // 重置
            systemA.onUpdateCalled = false;

            // 再次更新不应该重新排序（脏标记已清除）
            systemList.update(world, 0.016);
            expect(systemA.onUpdateCalled).toBe(true);
        });
    });

    describe('remove', () => {
        it('应该能够移除系统类型', () => {
            systemList.add(TestSystemA);
            systemList.add(TestSystemB);

            systemList.remove(TestSystemA);

            expect(systemList.getCount()).toBe(1);
        });

        it('移除不存在的系统应该不报错', () => {
            systemList.remove(TestSystemA);

            expect(systemList.getCount()).toBe(0);
        });

        it('移除系统后应该标记为脏', () => {
            world.registerSystem(TestSystemA);
            world.registerSystem(TestSystemB);

            systemList.add(TestSystemA);
            systemList.add(TestSystemB);
            systemList.update(world, 0.016); // 第一次更新，触发排序

            systemList.remove(TestSystemA);
            systemList.update(world, 0.016); // 应该重新排序

            const systemB = world.getSystem(TestSystemB)!;
            expect(systemB.onUpdateCalled).toBe(true);
        });
    });

    describe('update', () => {
        it('应该按 priority 顺序执行系统', () => {
            world.registerSystem(TestSystemC);
            world.registerSystem(TestSystemA);
            world.registerSystem(TestSystemB);

            // 按不同顺序添加，但应该按 priority 执行
            systemList.add(TestSystemC);
            systemList.add(TestSystemA);
            systemList.add(TestSystemB);

            const executionOrder: number[] = [];
            const systemA = world.getSystem(TestSystemA)!;
            const systemB = world.getSystem(TestSystemB)!;
            const systemC = world.getSystem(TestSystemC)!;

            // 修改 onUpdate 来记录执行顺序
            systemA.onUpdate = () => { executionOrder.push(0); };
            systemB.onUpdate = () => { executionOrder.push(1); };
            systemC.onUpdate = () => { executionOrder.push(2); };

            systemList.update(world, 0.016);

            expect(executionOrder).toEqual([0, 1, 2]);
        });

        it('应该只执行已启用的系统', () => {
            world.registerSystem(TestSystemA);
            world.registerSystem(TestSystemB);

            systemList.add(TestSystemA);
            systemList.add(TestSystemB);

            const systemA = world.getSystem(TestSystemA)!;
            const systemB = world.getSystem(TestSystemB)!;

            systemB.enabled = false;

            systemList.update(world, 0.016);

            expect(systemA.onUpdateCalled).toBe(true);
            expect(systemB.onUpdateCalled).toBe(false);
        });

        it('应该只在脏标记为 true 时重新排序', () => {
            world.registerSystem(TestSystemA);

            systemList.add(TestSystemA);
            systemList.update(world, 0.016); // 第一次更新，触发排序

            const systemA = world.getSystem(TestSystemA)!;
            systemA.onUpdateCalled = false;

            systemList.update(world, 0.016); // 第二次更新，不应该重新排序

            expect(systemA.onUpdateCalled).toBe(true);
        });

        it('应该过滤掉未注册的系统', () => {
            systemList.add(TestSystemA);
            systemList.add(TestSystemB);

            // 只注册 TestSystemA
            world.registerSystem(TestSystemA);

            systemList.update(world, 0.016);

            const systemA = world.getSystem(TestSystemA)!;
            expect(systemA.onUpdateCalled).toBe(true);
        });
    });

    describe('markDirty', () => {
        it('应该强制下次更新时重新排序', () => {
            world.registerSystem(TestSystemA);

            systemList.add(TestSystemA);
            systemList.update(world, 0.016); // 第一次更新

            systemList.markDirty();
            systemList.update(world, 0.016); // 应该重新排序

            const systemA = world.getSystem(TestSystemA)!;
            expect(systemA.onUpdateCalled).toBe(true);
        });
    });

    describe('getCount', () => {
        it('应该返回正确的系统数量', () => {
            expect(systemList.getCount()).toBe(0);

            systemList.add(TestSystemA);
            expect(systemList.getCount()).toBe(1);

            systemList.add(TestSystemB);
            expect(systemList.getCount()).toBe(2);
        });
    });

    describe('clear', () => {
        it('应该清空所有系统', () => {
            systemList.add(TestSystemA);
            systemList.add(TestSystemB);

            systemList.clear();

            expect(systemList.getCount()).toBe(0);
        });

        it('清空后更新不应该执行任何系统', () => {
            world.registerSystem(TestSystemA);
            systemList.add(TestSystemA);
            systemList.clear();

            systemList.update(world, 0.016);

            const systemA = world.getSystem(TestSystemA)!;
            expect(systemA.onUpdateCalled).toBe(false);
        });
    });
});
