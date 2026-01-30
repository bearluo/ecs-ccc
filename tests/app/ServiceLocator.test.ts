/// <reference types="jest" />
/**
 * ServiceLocator 单元测试
 */

import { ServiceLocator } from 'db://assets/scripts/app/ServiceLocator';

// 测试用的服务类
class TestService {
    value: string;
    constructor(value: string = 'test') {
        this.value = value;
    }
}

class AnotherService {
    id: number;
    constructor(id: number = 0) {
        this.id = id;
    }
}

describe('ServiceLocator', () => {
    beforeEach(() => {
        // 每个测试前清空服务
        ServiceLocator.clear();
    });

    afterEach(() => {
        // 每个测试后清空服务
        ServiceLocator.clear();
    });

    describe('register', () => {
        it('应该注册服务', () => {
            const service = new TestService('test-value');

            ServiceLocator.register(TestService, service);

            expect(ServiceLocator.has(TestService)).toBe(true);
        });

        it('应该在重复注册时发出警告', () => {
            const service1 = new TestService('value1');
            const service2 = new TestService('value2');
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            ServiceLocator.register(TestService, service1);
            ServiceLocator.register(TestService, service2);

            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(ServiceLocator.get(TestService)).toBe(service2); // 应该被替换

            consoleWarnSpy.mockRestore();
        });

        it('应该支持注册多个不同类型的服务', () => {
            const testService = new TestService('test');
            const anotherService = new AnotherService(123);

            ServiceLocator.register(TestService, testService);
            ServiceLocator.register(AnotherService, anotherService);

            expect(ServiceLocator.has(TestService)).toBe(true);
            expect(ServiceLocator.has(AnotherService)).toBe(true);
        });
    });

    describe('get', () => {
        it('应该获取已注册的服务', () => {
            const service = new TestService('test-value');
            ServiceLocator.register(TestService, service);

            const retrieved = ServiceLocator.get(TestService);

            expect(retrieved).toBe(service);
            expect(retrieved?.value).toBe('test-value');
        });

        it('应该为未注册的服务返回 null', () => {
            const retrieved = ServiceLocator.get(TestService);

            expect(retrieved).toBeNull();
        });

        it('应该返回正确的类型', () => {
            const service = new TestService('test-value');
            ServiceLocator.register(TestService, service);

            const retrieved = ServiceLocator.get(TestService);

            expect(retrieved).toBeInstanceOf(TestService);
        });
    });

    describe('require', () => {
        it('应该获取已注册的服务', () => {
            const service = new TestService('test-value');
            ServiceLocator.register(TestService, service);

            const retrieved = ServiceLocator.require(TestService);

            expect(retrieved).toBe(service);
            expect(retrieved.value).toBe('test-value');
        });

        it('应该在服务未注册时抛出错误', () => {
            expect(() => {
                ServiceLocator.require(TestService);
            }).toThrow('[ServiceLocator] Service TestService is not registered');
        });

        it('应该抛出包含服务名称的错误', () => {
            expect(() => {
                ServiceLocator.require(AnotherService);
            }).toThrow('[ServiceLocator] Service AnotherService is not registered');
        });
    });

    describe('has', () => {
        it('应该返回 true 如果服务已注册', () => {
            const service = new TestService();
            ServiceLocator.register(TestService, service);

            expect(ServiceLocator.has(TestService)).toBe(true);
        });

        it('应该返回 false 如果服务未注册', () => {
            expect(ServiceLocator.has(TestService)).toBe(false);
        });

        it('应该在取消注册后返回 false', () => {
            const service = new TestService();
            ServiceLocator.register(TestService, service);
            ServiceLocator.unregister(TestService);

            expect(ServiceLocator.has(TestService)).toBe(false);
        });
    });

    describe('unregister', () => {
        it('应该取消注册服务', () => {
            const service = new TestService();
            ServiceLocator.register(TestService, service);

            ServiceLocator.unregister(TestService);

            expect(ServiceLocator.has(TestService)).toBe(false);
            expect(ServiceLocator.get(TestService)).toBeNull();
        });

        it('应该安全地取消注册未注册的服务', () => {
            expect(() => {
                ServiceLocator.unregister(TestService);
            }).not.toThrow();
        });
    });

    describe('clear', () => {
        it('应该清空所有已注册的服务', () => {
            const service1 = new TestService();
            const service2 = new AnotherService();

            ServiceLocator.register(TestService, service1);
            ServiceLocator.register(AnotherService, service2);

            ServiceLocator.clear();

            expect(ServiceLocator.has(TestService)).toBe(false);
            expect(ServiceLocator.has(AnotherService)).toBe(false);
        });

        it('应该可以在空状态下安全调用', () => {
            expect(() => {
                ServiceLocator.clear();
            }).not.toThrow();
        });
    });

    describe('类型安全', () => {
        it('应该保持类型安全', () => {
            const testService = new TestService('test-value');
            const anotherService = new AnotherService(123);

            ServiceLocator.register(TestService, testService);
            ServiceLocator.register(AnotherService, anotherService);

            const retrievedTest = ServiceLocator.get(TestService);
            const retrievedAnother = ServiceLocator.get(AnotherService);

            // TypeScript 类型推断应该正确
            if (retrievedTest) {
                expect(typeof retrievedTest.value).toBe('string');
                // @ts-expect-error - 确保类型安全，不应该有 id 属性
                expect(retrievedTest.id).toBeUndefined();
            }

            if (retrievedAnother) {
                expect(typeof retrievedAnother.id).toBe('number');
                // @ts-expect-error - 确保类型安全，不应该有 value 属性
                expect(retrievedAnother.value).toBeUndefined();
            }
        });
    });

    describe('使用场景', () => {
        it('应该支持服务的生命周期管理', () => {
            const service1 = new TestService('initial');
            ServiceLocator.register(TestService, service1);

            // 获取服务
            let service = ServiceLocator.require(TestService);
            expect(service.value).toBe('initial');

            // 替换服务
            const service2 = new TestService('updated');
            ServiceLocator.register(TestService, service2);
            service = ServiceLocator.require(TestService);
            expect(service.value).toBe('updated');

            // 取消注册
            ServiceLocator.unregister(TestService);
            expect(ServiceLocator.has(TestService)).toBe(false);
        });

        it('应该支持可选服务检查', () => {
            // 未注册时使用 get
            const optional = ServiceLocator.get(TestService);
            expect(optional).toBeNull();

            // 注册后使用 require
            const service = new TestService('required');
            ServiceLocator.register(TestService, service);

            const required = ServiceLocator.require(TestService);
            expect(required.value).toBe('required');
        });
    });
});
