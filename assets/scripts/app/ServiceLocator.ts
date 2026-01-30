/**
 * 服务定位器
 * 
 * 提供全局服务的注册和访问
 * 支持类型安全的服务访问
 * 
 * 设计决策：轻量级服务注册表（类型安全的泛型支持）
 * 参考文档：memory-bank/creative/creative-service-locator.md
 * 
 * 使用示例：
 * // 注册服务
 * ServiceLocator.register(World, this.world);
 * 
 * // 获取服务（可选，不存在返回 null）
 * const world = ServiceLocator.get(World);
 * 
 * // 获取服务（必需，不存在时抛出错误）
 * const world = ServiceLocator.require(World);
 */
export class ServiceLocator {
    private static services: Map<Function, any> = new Map();

    /**
     * 注册服务
     * @param serviceClass 服务类（构造函数）
     * @param instance 服务实例
     */
    static register<T>(serviceClass: new (...args: any[]) => T, instance: T): void {
        if (this.services.has(serviceClass)) {
            console.warn(`[ServiceLocator] Service ${serviceClass.name} is already registered, replacing...`);
        }
        this.services.set(serviceClass, instance);
    }

    /**
     * 获取服务（可选，不存在返回 null）
     * @param serviceClass 服务类（构造函数）
     * @returns 服务实例，如果未注册返回 null
     */
    static get<T>(serviceClass: new (...args: any[]) => T): T | null {
        return this.services.get(serviceClass) || null;
    }

    /**
     * 获取服务（必需，不存在时抛出错误）
     * @param serviceClass 服务类（构造函数）
     * @returns 服务实例
     * @throws Error 如果服务未注册
     */
    static require<T>(serviceClass: new (...args: any[]) => T): T {
        const service = this.services.get(serviceClass);
        if (!service) {
            throw new Error(`[ServiceLocator] Service ${serviceClass.name} is not registered`);
        }
        return service;
    }

    /**
     * 检查服务是否已注册
     * @param serviceClass 服务类（构造函数）
     * @returns 是否已注册
     */
    static has<T>(serviceClass: new (...args: any[]) => T): boolean {
        return this.services.has(serviceClass);
    }

    /**
     * 取消注册服务
     * @param serviceClass 服务类（构造函数）
     */
    static unregister<T>(serviceClass: new (...args: any[]) => T): void {
        this.services.delete(serviceClass);
    }

    /**
     * 清空所有服务（用于测试或清理）
     */
    static clear(): void {
        this.services.clear();
    }
}
