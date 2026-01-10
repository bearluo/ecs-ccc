/**
 * Cocos Creator 'cc' 模块 Mock
 * 
 * 用于 Jest 测试环境，模拟 Cocos Creator 的核心 API
 * 参考 Cocos Creator 3.8.7 的类型定义文件
 */

// Mock resources API (AssetManager.Bundle)
const mockResources = {
    load: jest.fn((path: string, type: any, callback?: (err: Error | null, asset?: any) => void) => {
        // 如果提供了 callback，使用回调方式（Cocos Creator 的标准方式）
        if (callback) {
            // 使用 Promise.resolve().then() 确保异步执行
            Promise.resolve().then(() => {
                if (path.includes('error')) {
                    callback(new Error('Mock load error'));
                } else {
                    // 根据 type 创建对应的 mock 对象
                    let mockAsset: any;
                    const assetName = path.split('/').pop() || path;
                    // 检查 type 是否是 Mock 类（通过类型名称判断）
                    // 注意：导出的 Prefab/Texture2D/AudioClip 就是 MockPrefab/MockTexture2D/MockAudioClip
                    const typeName = type?.name || '';
                    if (type === MockPrefab || typeName === 'Prefab' || typeName === 'MockPrefab') {
                        mockAsset = new MockPrefab(assetName);
                    } else if (type === MockTexture2D || typeName === 'Texture2D' || typeName === 'MockTexture2D') {
                        mockAsset = new MockTexture2D(assetName);
                    } else if (type === MockAudioClip || typeName === 'AudioClip' || typeName === 'MockAudioClip') {
                        mockAsset = new MockAudioClip(assetName);
                    } else {
                        mockAsset = { name: assetName };
                    }
                    callback(null, mockAsset);
                }
            });
            return;
        }
        // 如果没有 callback，返回 Promise（兼容 Promise 方式）
        return new Promise((resolve, reject) => {
            Promise.resolve().then(() => {
                if (path.includes('error')) {
                    reject(new Error('Mock load error'));
                } else {
                    let mockAsset: any;
                    const assetName = path.split('/').pop() || path;
                    if (type === MockPrefab || (type && type.name === 'Prefab')) {
                        mockAsset = new MockPrefab(assetName);
                    } else if (type === MockTexture2D || (type && type.name === 'Texture2D')) {
                        mockAsset = new MockTexture2D(assetName);
                    } else if (type === MockAudioClip || (type && type.name === 'AudioClip')) {
                        mockAsset = new MockAudioClip(assetName);
                    } else {
                        mockAsset = { name: assetName };
                    }
                    resolve(mockAsset);
                }
            });
        });
    }),
    release: jest.fn((asset: any) => {
        // Mock release implementation
    }),
    loadDir: jest.fn(),
    preload: jest.fn(),
    preloadDir: jest.fn(),
    getInfoWithPath: jest.fn(),
    name: 'resources',
    base: '',
    deps: []
};

// Mock Prefab 类 (extends Asset)
class MockPrefab {
    name: string = '';
    data: any = null;
    optimizationPolicy: number = 0;

    constructor(name: string = '') {
        this.name = name;
    }

    destroy(): boolean {
        return true;
    }
}

// Mock Texture2D 类 (extends SimpleTexture)
class MockTexture2D {
    name: string = '';
    width: number = 0;
    height: number = 0;
    image: any = null;
    mipmaps: any[] = [];

    constructor(name: string = '') {
        this.name = name;
    }

    destroy(): boolean {
        return true;
    }
}

// Mock AudioClip 类 (extends Asset)
class MockAudioClip {
    name: string = '';
    duration: number = 0;
    loadMode: number = 0;

    constructor(name: string = '') {
        this.name = name;
    }

    destroy(): boolean {
        return true;
    }
}

// Mock Node 类 (extends CCObject)
class MockNode {
    name: string = '';
    active: boolean = true;
    position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    parent: MockNode | null = null;
    children: MockNode[] = [];
    components: any[] = [];
    uuid: string = '';
    scene: any = null;
    activeInHierarchy: boolean = true;

    constructor(name?: string) {
        if (name) {
            this.name = name;
        }
        this.uuid = `mock-uuid-${Math.random()}`;
    }

    setPosition(x: number, y: number, z: number): void {
        this.position = { x, y, z };
    }

    setRotationFromEuler(x: number, y: number, z: number): void {
        // Mock implementation
    }

    setScale(x: number, y: number, z: number): void {
        // Mock implementation
    }

    addChild(child: MockNode): void {
        this.children.push(child);
        child.parent = this;
    }

    removeChild(child: MockNode): void {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    destroy(): boolean {
        // Mock implementation
        return true;
    }

    getComponent<T>(type: any): T | null {
        // 如果请求 ParticleSystem2D，返回 mock 实例
        if (type && (type.name === 'ParticleSystem2D' || type.name === 'MockParticleSystem2D')) {
            return new MockParticleSystem2D() as T;
        }
        // 查找已存在的组件
        const existing = this.components.find(c => c instanceof type || (c.constructor && c.constructor.name === type.name));
        if (existing) {
            return existing as T;
        }
        return null;
    }

    getComponents<T>(type: any): T[] {
        return this.components.filter(c => c instanceof type || (c.constructor && c.constructor.name === type.name)) as T[];
    }

    addComponent<T>(type: any): T {
        let comp: any;
        // 如果类型是 AudioSource，创建 MockAudioSource
        if (type && (type.name === 'AudioSource' || type.name === 'MockAudioSource')) {
            comp = new MockAudioSource();
        } else {
            comp = new type();
        }
        this.components.push(comp);
        return comp as T;
    }

    removeFromParent(): void {
        if (this.parent) {
            this.parent.removeChild(this);
        }
    }

    getWorldPosition(): { x: number; y: number; z: number } {
        return { ...this.position };
    }

    isValid: boolean = true;
}

// Mock Animation 类
class MockAnimation {
    defaultClip: MockAnimationClip | null = null;
    private states: Map<string, MockAnimationState> = new Map();

    play(name: string): void {
        // Mock implementation
    }

    stop(name?: string): void {
        // Mock implementation
    }

    getState(name: string): MockAnimationState | null {
        return this.states.get(name) || null;
    }

    on(type: string, callback: Function, target?: any): void {
        // Mock implementation
    }

    off(type: string, callback?: Function, target?: any): void {
        // Mock implementation
    }
}

// Mock AnimationClip 类
class MockAnimationClip {
    name: string = '';
    duration: number = 0;
    events: any[] = [];
}

// Mock AnimationState 类
class MockAnimationState {
    name: string = '';
    speed: number = 1.0;
    wrapMode: any = 0; // WrapMode enum
    time: number = 0;
    duration: number = 0;
    isPlaying: boolean = false;
    isPaused: boolean = false;
}

// Mock AudioSource 类
class MockAudioSource {
    clip: MockAudioClip | null = null;
    volume: number = 1.0;
    loop: boolean = false;
    playing: boolean = false;

    play(): void {
        this.playing = true;
    }

    stop(): void {
        this.playing = false;
    }

    pause(): void {
        this.playing = false;
    }

    resume(): void {
        this.playing = true;
    }
}

// Mock ParticleSystem2D 类
class MockParticleSystem2D {
    enabled: boolean = true;
    active: boolean = false;
    resetSystemCalled: boolean = false;
    stopSystemCalled: boolean = false;

    resetSystem(): void {
        this.resetSystemCalled = true;
        this.active = true;
    }

    stopSystem(): void {
        this.stopSystemCalled = true;
        this.active = false;
    }

    play(): void {
        this.active = true;
    }

    stop(): void {
        this.active = false;
    }
}

// Mock director
const mockDirector = {
    getScene: jest.fn(() => {
        // 返回一个 mock Scene 对象，具有 addComponent 方法
        return {
            addComponent: jest.fn((type: any) => {
                if (type && (type.name === 'AudioSource' || type.name === 'MockAudioSource')) {
                    return new MockAudioSource();
                }
                return new type();
            })
        };
    }),
    loadScene: jest.fn(),
    runScene: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    end: jest.fn(),
    restart: jest.fn()
};

// Mock instantiate 函数
const mockInstantiate = jest.fn((prefab: any) => {
    const node = new MockNode(prefab?.name || 'InstantiatedNode');
    return node;
});

// 导出所有 mock
export {
    MockPrefab as Prefab,
    MockTexture2D as Texture2D,
    MockAudioClip as AudioClip,
    MockNode as Node,
    MockAnimation as Animation,
    MockAnimationClip as AnimationClip,
    MockAnimationState as AnimationState,
    MockAudioSource as AudioSource,
    MockParticleSystem2D as ParticleSystem2D,
    mockResources as resources,
    mockDirector as director,
    mockInstantiate as instantiate,
};

// 导出枚举（如果需要）
export enum WrapMode {
    Normal = 0,
    Loop = 1,
    PingPong = 2,
    Reverse = 3,
}

// 导出事件类型（如果需要）
export enum EventType {
    FINISHED = 'finished',
    PLAY = 'play',
    STOP = 'stop',
    PAUSE = 'pause',
    RESUME = 'resume',
}

// 导出 Component 基类（简化版）
export class Component {
    node: MockNode | null = null;
    enabled: boolean = true;
    uuid: string = '';

    constructor() {
        this.uuid = `mock-comp-uuid-${Math.random()}`;
    }

    onLoad(): void {}
    start(): void {}
    update(dt: number): void {}
    lateUpdate(dt: number): void {}
    onDestroy(): void {}
    onEnable(): void {}
    onDisable(): void {}
}

// 导出 Scene 类（简化版）
export class Scene extends MockNode {
    constructor(name?: string) {
        super(name);
    }
}
