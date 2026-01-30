/**
 * 游戏测试场景
 * 
 * 用于测试 ECS 游戏框架的核心功能：
 * 
 * 阶段 1 功能：
 * - 实体创建和组件管理
 * - 移动系统
 * - 战斗系统
 * - 死亡系统
 * - 渲染同步系统
 * - 命令和事件传递
 * 
 * 阶段 2 功能：
 * - 扩展组件（Collider、Faction、BuffList、SkillSlots、AnimationIntent、DestroyTimer、AI）
 * - 扩展系统（InputSystem、AISystem、CollisionSystem、BuffSystem、SkillSystem、CooldownSystem、AnimationIntentSystem）
 * - 表现层扩展（ViewPool、FxDriver、AudioDriver、NodeBinder）
 * - 配置系统（ConfigLoader）
 */

import { Component, _decorator, Node, Label } from 'cc';
import { Entity, World } from '@bl-framework/ecs';
import { Scheduler } from '../../scripts/bridge/Scheduler';
import { CommandBuffer } from '../../scripts/bridge/CommandBuffer';
import { EventBus } from '../../scripts/bridge/EventBus';
import { ViewManager } from '../../scripts/presentation/ViewManager';
import { AnimDriver } from '../../scripts/presentation/AnimDriver';
import { FxDriver } from '../../scripts/presentation/FxDriver';
import { AudioDriver } from '../../scripts/presentation/AudioDriver';
import { ConfigLoader } from '../../scripts/ConfigLoader';
import { ResourceManager } from '../../scripts/presentation/ResourceManager';
import { ResourcePreloader } from '../../scripts/presentation/ResourcePreloader';
import { TestStartupPreloadConfig } from '../data/configs/resource-preload';
import { TestSkillConfigs } from '../data/configs/skills';
import { TestBuffConfigs } from '../data/configs/buffs';

// 阶段 1 组件
import { TransformComponent } from '../../scripts/gameplay/components/Transform';
import { VelocityComponent } from '../../scripts/gameplay/components/Velocity';
import { HPComponent } from '../../scripts/gameplay/components/HP';
import { ViewLinkComponent } from '../../scripts/gameplay/components/ViewLink';
import { DeadTagComponent } from '../../scripts/gameplay/components/DeadTag';
import { AnimStateComponent } from '../../scripts/gameplay/components/AnimState';

// 阶段 2 组件
import { ColliderComponent } from '../../scripts/gameplay/components/Collider';
import { FactionComponent, FactionType } from '../../scripts/gameplay/components/Faction';
import { BuffListComponent } from '../../scripts/gameplay/components/BuffList';
import { SkillSlotsComponent } from '../../scripts/gameplay/components/SkillSlots';
import { AnimationIntentComponent } from '../../scripts/gameplay/components/AnimationIntent';
import { DestroyTimerComponent } from '../../scripts/gameplay/components/DestroyTimer';
import { AIComponent } from '../../scripts/gameplay/components/AI';
import { NeedViewTagComponent } from '../../scripts/gameplay/components/NeedViewTag';
import { FxIntentComponent } from '../../scripts/gameplay/components/FxIntent';
import { AudioIntentComponent } from '../../scripts/gameplay/components/AudioIntent';
import { StatsComponent } from '../../scripts/gameplay/components/Stats';
import { LevelExperienceComponent } from '../../scripts/gameplay/components/LevelExperience';
import { InventoryComponent } from '../../scripts/gameplay/components/Inventory';
import { EquipmentComponent } from '../../scripts/gameplay/components/Equipment';

// 阶段 1 系统
import { MoveSystem } from '../../scripts/gameplay/systems/MoveSystem';
import { CombatSystem } from '../../scripts/gameplay/systems/CombatSystem';
import { DeathSystem } from '../../scripts/gameplay/systems/DeathSystem';
import { DestroySystem } from '../../scripts/gameplay/systems/DestroySystem';
import { RenderSyncSystem } from '../../scripts/gameplay/systems/RenderSyncSystem';

// 阶段 2 系统
import { InputSystem } from '../../scripts/gameplay/systems/InputSystem';
import { AISystem } from '../../scripts/gameplay/systems/AISystem';
import { CollisionSystem } from '../../scripts/gameplay/systems/CollisionSystem';
import { BuffSystem } from '../../scripts/gameplay/systems/BuffSystem';
import { SkillSystem } from '../../scripts/gameplay/systems/SkillSystem';
import { CooldownSystem } from '../../scripts/gameplay/systems/CooldownSystem';
import { AnimationIntentSystem } from '../../scripts/gameplay/systems/AnimationIntentSystem';
import { AnimationEventSystem } from '../../scripts/gameplay/systems/AnimationEventSystem';
import { ViewSpawnSystem } from '../../scripts/gameplay/systems/ViewSpawnSystem';
import { SaveSystem } from '../../scripts/gameplay/systems/SaveSystem';
import { ServiceLocator } from '../../scripts/app/ServiceLocator';

const { ccclass, property } = _decorator;

@ccclass('SceneTestGame')
export class SceneTestGame extends Component {
    private world!: World;
    private scheduler!: Scheduler;
    private commandBuffer!: CommandBuffer;
    private eventBus!: EventBus;
    private viewManager!: ViewManager;
    private animDriver!: AnimDriver;
    private fxDriver!: FxDriver;
    private audioDriver!: AudioDriver;
    private configLoader!: ConfigLoader;
    private resourceManager!: ResourceManager;
    private resourcePreloader!: ResourcePreloader;
    private saveSystem!: SaveSystem;

    /** 测试实体 */
    private playerEntity: Entity = null; // Entity
    private enemyEntities: Entity[] = []; // Entity[]

    /** UI 标签（用于显示调试信息） */
    @property(Label)
    debugLabel: Label | null = null;
    
    /** 视图父节点 */
    @property(Node)
    public viewParent: Node = null!;

    async onLoad() {
        console.log('[SceneTestGame] Initializing Phase 2 Test...');

        // 初始化桥接层
        this.commandBuffer = new CommandBuffer();
        this.eventBus = new EventBus();

        // 初始化 ECS 世界
        this.world = new World({
            debug: true,
            initialEntityPoolSize: 1000,
            componentPoolSize: 100
        });

        // 初始化调度器
        this.scheduler = new Scheduler(
            this.world,
            this.commandBuffer,
            this.eventBus,
            {
                fixedDeltaTime: 1 / 60, // 60 FPS
                maxAccumulator: 0.25    // 最大累积 250ms
            }
        );

        // 初始化资源管理器
        this.resourceManager = new ResourceManager();
        ServiceLocator.register(ResourceManager, this.resourceManager);
        
        // 初始化资源预加载器
        this.resourcePreloader = new ResourcePreloader();
        ServiceLocator.register(ResourcePreloader, this.resourcePreloader);

        // 初始化配置系统（必须在 Driver 初始化之前）
        this.configLoader = new ConfigLoader();
        
        // 初始化存档系统（必须在 ConfigLoader 之后）
        this.saveSystem = this.world.registerSystem(SaveSystem);
        this.saveSystem.setConfigLoader(this.configLoader);
        
        // 初始化表现层
        this.viewManager = new ViewManager();
        ServiceLocator.register(ViewManager, this.viewManager);
        this.viewManager.setEventBus(this.eventBus); // 设置 EventBus，用于发送视图创建确认事件
        this.viewManager.setWorld(this.world); // 设置 World，用于查询实体
        this.viewManager.setViewParent(this.viewParent); // 设置视图父节点
        
        this.animDriver = new AnimDriver(this.eventBus);
        this.viewManager.setAnimDriver(this.animDriver); // 设置 AnimDriver，用于播放动画
        
        this.fxDriver = new FxDriver(this.resourceManager, this.configLoader);
        this.viewManager.setFxDriver(this.fxDriver); // 设置 FxDriver，用于播放特效
        
        this.audioDriver = new AudioDriver(this.resourceManager, this.configLoader);
        this.audioDriver.setViewParent(this.viewParent); // 设置视图父节点，初始化音频源
        this.viewManager.setAudioDriver(this.audioDriver); // 设置 AudioDriver，用于播放音效

        // 启动时预加载测试资源（可选：显示加载进度）
        try {
            // 第一步：使用 ResourcePreloader 预加载资源到 ResourceManager
            await this.resourcePreloader.preloadParallel(
                TestStartupPreloadConfig,
                (progress) => {
                    console.log(`[SceneTestGame] Resource preload progress: ${(progress * 100).toFixed(1)}%`);
                }
            );
            console.log('[SceneTestGame] Resource preload completed');

            // 第二步：使用 ViewPool 预加载 Prefab（将 ResourceManager 中已加载的 Prefab 设置到 ViewPool）
            // 注意：prefabKey 与路径的映射关系
            await this.viewManager.getViewPool().preloadPrefabs([
                { prefabKey: 'player', path: 'tests/prefabs/player' },
                { prefabKey: 'enemy', path: 'tests/prefabs/enemy' }
            ]);
            console.log('[SceneTestGame] ViewPool preload completed');
        } catch (error) {
            console.error('[SceneTestGame] Preload failed:', error);
            // 继续游戏，如果 Prefab 未加载，ViewPool.get() 会返回 null，由 RenderSyncSystem 处理
        }

        // 注册阶段 1 Fixed Systems (priority 0-99)
        this.world.registerSystem(MoveSystem);
        this.world.registerSystem(CombatSystem);
        this.world.registerSystem(DeathSystem);
        this.scheduler.registerFixedSystem(MoveSystem);
        this.scheduler.registerFixedSystem(CombatSystem);
        this.scheduler.registerFixedSystem(DeathSystem);

        // 注册 DestroySystem（处理实体销毁，两阶段销毁 + 超时保护）
        const destroySystem = this.world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(this.commandBuffer);
        destroySystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(DestroySystem);

        // 注册阶段 2 Fixed Systems
        const inputSystem = this.world.registerSystem(InputSystem);
        inputSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(InputSystem);

        this.world.registerSystem(AISystem);
        this.scheduler.registerFixedSystem(AISystem);

        const collisionSystem = this.world.registerSystem(CollisionSystem);
        collisionSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(CollisionSystem);

        this.world.registerSystem(BuffSystem);
        this.scheduler.registerFixedSystem(BuffSystem);

        this.world.registerSystem(SkillSystem);
        this.scheduler.registerFixedSystem(SkillSystem);

        this.world.registerSystem(CooldownSystem);
        this.scheduler.registerFixedSystem(CooldownSystem);

        // 注册 ViewSpawnSystem（处理视图创建确认）
        const viewSpawnSystem = this.world.registerSystem(ViewSpawnSystem);
        viewSpawnSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(ViewSpawnSystem);

        // 注册 AnimationEventSystem（处理动画事件）
        const animationEventSystem = this.world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(this.eventBus);
        this.scheduler.registerFixedSystem(AnimationEventSystem);

        // 注册 Render Systems (priority 100+)
        const animationIntentSystem = this.world.registerSystem(AnimationIntentSystem);
        this.scheduler.registerRenderSystem(AnimationIntentSystem);

        const renderSyncSystem = this.world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(this.commandBuffer);
        this.scheduler.registerRenderSystem(RenderSyncSystem);

        // 创建测试实体
        this.createTestEntities();

        console.log('[SceneTestGame] Phase 2 Test Initialized');
    }

    /**
     * 创建测试实体
     */
    private createTestEntities(): void {
        // 创建玩家（带技能和 Buff）
        const player = this.world.createEntity('Player');
        this.playerEntity = player;

        const playerTransform = player.addComponent(TransformComponent);
        playerTransform.x = 0;
        playerTransform.y = 0;

        const playerVelocity = player.addComponent(VelocityComponent);
        playerVelocity.vx = 0;
        playerVelocity.vy = 0;

        const playerHP = player.addComponent(HPComponent);
        playerHP.cur = 100;
        playerHP.max = 100;

        // 添加 Stats 组件（SaveSystem 需要）
        const playerStats = player.addComponent(StatsComponent);
        playerStats.base.attack = 10;
        playerStats.base.defense = 5;

        // 添加 LevelExperience 组件（SaveSystem 需要，用于识别玩家实体）
        const playerLevelExp = player.addComponent(LevelExperienceComponent);
        playerLevelExp.level = 1;
        playerLevelExp.maxLevel = 100;
        playerLevelExp.exp = 0;
        playerLevelExp.expRequired = 100;

        // 添加 Inventory 组件（SaveSystem 需要）
        player.addComponent(InventoryComponent);

        // 添加 Equipment 组件（SaveSystem 需要）
        player.addComponent(EquipmentComponent);

        const playerFaction = player.addComponent(FactionComponent);
        playerFaction.faction = FactionType.Player;

        const playerCollider = player.addComponent(ColliderComponent);
        playerCollider.type = 'circle';
        playerCollider.radius = 20;
        playerCollider.layer = 1; // PLAYER layer

        const playerViewLink = player.addComponent(ViewLinkComponent);
        playerViewLink.prefabKey = 'player';
        playerViewLink.viewId = 0;
        player.addComponent(NeedViewTagComponent); // 标记需要创建视图

        const playerAnimState = player.addComponent(AnimStateComponent);
        const playerAnimIntent = player.addComponent(AnimationIntentComponent);
        playerAnimIntent.setContinuousIntent('idle');

        // 添加技能槽（使用测试配置）
        const playerSkills = player.addComponent(SkillSlotsComponent);
        const testFireballConfig = TestSkillConfigs['test-fireball'];
        if (testFireballConfig) {
            playerSkills.setSkill(0, 'test-fireball', testFireballConfig);
        }
        const testHealConfig = TestSkillConfigs['test-heal'];
        if (testHealConfig) {
            playerSkills.setSkill(1, 'test-heal', testHealConfig);
        }

        // 添加 Buff 列表
        player.addComponent(BuffListComponent);

        // 创建 AI 敌人（带 AI 组件和技能）
        for (let i = 0; i < 3; i++) {
            const enemy = this.world.createEntity(`Enemy_${i}`);
            this.enemyEntities.push(enemy);

            const enemyTransform = enemy.addComponent(TransformComponent);
            enemyTransform.x = 200 + i * 150; // 分散放置
            enemyTransform.y = 0;

            const enemyVelocity = enemy.addComponent(VelocityComponent);
            enemyVelocity.vx = 0;
            enemyVelocity.vy = 0;

            const enemyHP = enemy.addComponent(HPComponent);
            enemyHP.cur = 50;
            enemyHP.max = 50;

            const enemyFaction = enemy.addComponent(FactionComponent);
            enemyFaction.faction = FactionType.Enemy;

            const enemyCollider = enemy.addComponent(ColliderComponent);
            enemyCollider.type = 'circle';
            enemyCollider.radius = 15;
            enemyCollider.layer = 2; // ENEMY layer

            const enemyViewLink = enemy.addComponent(ViewLinkComponent);
            enemyViewLink.prefabKey = 'enemy';
            enemyViewLink.viewId = 0;
            enemy.addComponent(NeedViewTagComponent); // 标记需要创建视图

            const enemyAnimState = enemy.addComponent(AnimStateComponent);
            const enemyAnimIntent = enemy.addComponent(AnimationIntentComponent);
            enemyAnimIntent.setContinuousIntent('idle');

            // 添加 AI 组件
            const enemyAI = enemy.addComponent(AIComponent);
            enemyAI.type = 'chase';
            enemyAI.state = 'idle';
            enemyAI.perceptionRange = 200;
            enemyAI.attackRange = 50;

            // 添加 Buff 列表
            enemy.addComponent(BuffListComponent);
        }

        console.log(`[SceneTestGame] Created ${1 + this.enemyEntities.length} entities with Phase 2 components`);
    }

    update(dt: number) {
        if (!this.world || !this.scheduler) return;

        // 处理输入事件（模拟）
        // TODO: 从实际输入系统获取

        // Fixed Step（固定步长）
        this.scheduler.stepFixed(dt);

        // Render Step（渲染）
        this.scheduler.stepRender(dt);

        // 刷新命令到 ViewManager
        const commands = this.scheduler.flushCommandsToPresentation();
        if (commands.length > 0) {
            this.viewManager.processCommands(commands);
        }

        // 处理 EventBus 中的事件（ViewSpawnSystem 需要处理 ViewEvent）
        this.eventBus.flush();

        // ⚠️ 关键：必须在每帧调用 FxDriver.update(dt) 以统一管理特效生命周期
        // 不允许使用 setTimeout，必须通过 update(dt) 管理
        if (this.fxDriver) {
            this.fxDriver.update(dt);
        }

        // 更新调试信息
        this.updateDebugInfo();
    }

    /**
     * 更新调试信息
     */
    private updateDebugInfo(): void {
        if (!this.debugLabel) return;

        const player = this.playerEntity;
        if (!player) return;

        const playerTransform = player.getComponent(TransformComponent);
        const playerHP = player.getComponent(HPComponent);
        const playerDead = player.hasComponent(DeadTagComponent);
        const playerSkills = player.getComponent(SkillSlotsComponent);
        const playerBuffs = player.getComponent(BuffListComponent);
        const playerAI = player.getComponent(AIComponent);
        const playerAnimIntent = player.getComponent(AnimationIntentComponent);

        let info = `=== Phase 2 Game Test ===\n`;
        info += `Player: pos=(${playerTransform?.x.toFixed(1)}, ${playerTransform?.y.toFixed(1)}), `;
        info += `HP=${playerHP?.cur}/${playerHP?.max}, `;
        info += `Dead=${playerDead ? 'YES' : 'NO'}\n`;

        // 技能信息
        if (playerSkills) {
            const skills = playerSkills.getAllSkills();
            info += `Skills: ${skills.length} active\n`;
            skills.forEach((skill, index) => {
                info += `  Slot ${index}: ${skill.skillId}, CD=${skill.cooldown.toFixed(1)}s\n`;
            });
        }

        // Buff 信息
        if (playerBuffs) {
            const buffs = playerBuffs.getAllBuffs();
            info += `Buffs: ${buffs.length} active\n`;
            buffs.forEach(buff => {
                info += `  ${buff.type}: ${buff.duration.toFixed(1)}s (${buff.stacks} stacks)\n`;
            });
        }

        // 动画意图
        if (playerAnimIntent) {
            info += `Anim: ${playerAnimIntent.continuousIntent}`;
            if (playerAnimIntent.triggerIntent) {
                info += ` [${playerAnimIntent.triggerIntent}]`;
            }
            info += `\n`;
        }

        // 敌人信息
        info += `\nEnemies: ${this.enemyEntities.length}\n`;
        this.enemyEntities.forEach((enemy, index) => {
            if (!enemy) return;

            const enemyTransform = enemy.getComponent(TransformComponent);
            const enemyHP = enemy.getComponent(HPComponent);
            const enemyDead = enemy.hasComponent(DeadTagComponent);
            const enemyAI = enemy.getComponent(AIComponent);
            const enemyAnimIntent = enemy.getComponent(AnimationIntentComponent);

            if (enemyTransform && enemyHP) {
                info += `  Enemy ${index}: pos=(${enemyTransform.x.toFixed(1)}, ${enemyTransform.y.toFixed(1)}), `;
                info += `HP=${enemyHP.cur}/${enemyHP.max}, `;
                info += `Dead=${enemyDead ? 'YES' : 'NO'}`;
                if (enemyAI) {
                    info += `, AI=${enemyAI.state}`;
                    if (enemyAI.targetHandle) {
                        info += `, Target=${enemyAI.targetHandle.id}`;
                    }
                }
                if (enemyAnimIntent) {
                    info += `, Anim=${enemyAnimIntent.continuousIntent}`;
                }
                info += `\n`;
            }
        });

        // 统计信息
        const allEntitiesQuery = this.world.createQuery({ all: [] });
        const totalEntities = allEntitiesQuery.getCount();
        const commandsCount = this.commandBuffer.getCount();
        const poolStats = this.viewManager.getViewPool().getStats();
        
        info += `\n=== Stats ===\n`;
        info += `Total Entities: ${totalEntities}\n`;
        info += `Pending Commands: ${commandsCount}\n`;
        info += `Accumulator: ${this.scheduler.getAccumulator().toFixed(4)}\n`;
        
        // 对象池统计（注意：getStats() 不再返回 active 字段）
        const poolKeys = Object.keys(poolStats);
        if (poolKeys.length > 0) {
            info += `ViewPool: ${poolKeys.length} types\n`;
            poolKeys.forEach(key => {
                const stat = poolStats[key];
                // 注意：stat 现在只有 size 和 maxSize，不再有 active
                info += `  ${key}: pool=${stat.size}/${stat.maxSize}\n`;
            });
        }

        this.debugLabel.string = info;
    }

    /**
     * 测试：手动触发玩家移动（通过 InputSystem）
     */
    /**
     * 测试：手动触发玩家移动（通过 InputSystem）
     */
    public testPlayerMove(direction: 'left' | 'right' | 'up' | 'down'): void {
        const eventName = `move_${direction}`;
        this.eventBus.push({
            type: 'UIEvent',
            eventName: eventName,
            data: { isPressed: true }
        });
        this.eventBus.flush();
        console.log(`[SceneTestGame] Player move: ${direction}`);
    }

    /**
     * 测试：停止玩家移动
     */
    public testPlayerStop(): void {
        ['move_left', 'move_right', 'move_up', 'move_down'].forEach(eventName => {
            this.eventBus.push({
                type: 'UIEvent',
                eventName: eventName,
                data: { isPressed: false }
            });
        });
        this.eventBus.flush();
        console.log('[SceneTestGame] Player stop');
    }

    /**
     * 测试：触发玩家技能
     */
    public testPlayerSkill(slotIndex: number): void {
        const player = this.playerEntity;
        if (!player) return;

        const skills = player.getComponent(SkillSlotsComponent);
        if (!skills) return;

        const skill = skills.getSkill(slotIndex);
        if (!skill || !skills.isSkillReady(slotIndex)) {
            console.log(`[SceneTestGame] Skill slot ${slotIndex} not ready`);
            return;
        }

        this.eventBus.push({
            type: 'UIEvent',
            eventName: `skill_trigger_${slotIndex}`,
            data: { isPressed: true }
        });
        this.eventBus.flush();
        console.log(`[SceneTestGame] Player skill: ${skill.skillId}`);
    }

    /**
     * 测试：给玩家添加 Buff（使用测试配置）
     */
    public testAddBuffToPlayer(buffType: string, duration: number = 5.0): void {
        const player = this.playerEntity;
        if (!player) return;

        const buffs = player.getComponent(BuffListComponent);
        if (!buffs) return;

        // 优先使用测试配置，如果不存在则使用正式配置
        const testBuffConfig = TestBuffConfigs[buffType];
        const buffConfig = testBuffConfig || this.configLoader.getBuffConfig(buffType);
        
        if (buffConfig) {
            buffs.addBuff(
                `${buffType}_test`,
                buffConfig.type,
                duration,
                1,
                buffConfig.params
            );
            console.log(`[SceneTestGame] Added buff: ${buffType}, duration=${duration}s`);
        } else {
            console.warn(`[SceneTestGame] Buff config not found: ${buffType}`);
        }
    }

    /**
     * 测试：手动触发玩家攻击（旧方法，保留兼容）
     */
    public testPlayerAttack(): void {
        const player = this.playerEntity;
        if (!player) return;

        const playerHP = player.getComponent(HPComponent);
        if (!playerHP || playerHP.isDead) return;

        // 对最近的敌人造成伤害
        let nearestEnemy: any = null;
        let minDistance = Infinity;
        const playerTransform = player.getComponent(TransformComponent);

        this.enemyEntities.forEach(enemy => {
            if (!enemy) return;

            const enemyHP = enemy.getComponent(HPComponent);
            if (!enemyHP || enemyHP.isDead) return;

            const enemyTransform = enemy.getComponent(TransformComponent);
            if (!enemyTransform || !playerTransform) return;

            const dx = enemyTransform.x - playerTransform.x;
            const dy = enemyTransform.y - playerTransform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                nearestEnemy = enemy;
            }
        });

        if (nearestEnemy && minDistance < 200) {
            const enemyHP = nearestEnemy.getComponent(HPComponent);
            if (enemyHP) {
                enemyHP.cur = Math.max(0, enemyHP.cur - 20);
                console.log(`[SceneTestGame] Player attacked enemy ${nearestEnemy.id}, damage=20`);
            }
        }
    }

    /**
     * 测试：重置场景
     */
    public testReset(): void {
        console.log('[SceneTestGame] Resetting...');

        // 销毁所有实体（通过查询获取所有实体）
        const allEntitiesQuery = this.world.createQuery({ all: [] });
        allEntitiesQuery.forEach(entity => {
            this.world.destroyEntity(entity.id);
        });

        // 清空视图
        this.viewManager.clear();

        // 重置累积器
        this.scheduler.resetAccumulator();

        // 重新创建测试实体
        this.playerEntity = null;
        this.enemyEntities = [];
        this.createTestEntities();

        console.log('[SceneTestGame] Reset complete');
    }

    /**
     * 测试：测试配置系统（包括测试配置）
     */
    public testConfigLoader(): void {
        console.log('[SceneTestGame] Testing ConfigLoader...');

        // 测试正式技能配置
        const fireballConfig = this.configLoader.getSkillConfig('fireball');
        console.log('Fireball config:', fireballConfig);

        const allSkills = this.configLoader.getAllSkillConfigs();
        console.log(`Total skills: ${allSkills.length}`);

        // 测试测试技能配置
        console.log('Test skills:');
        Object.keys(TestSkillConfigs).forEach(key => {
            console.log(`  ${key}:`, TestSkillConfigs[key]);
        });

        // 测试正式 Buff 配置
        const speedBoostConfig = this.configLoader.getBuffConfig('speed_boost');
        console.log('Speed boost config:', speedBoostConfig);

        const allBuffs = this.configLoader.getAllBuffConfigs();
        console.log(`Total buffs: ${allBuffs.length}`);

        // 测试测试 Buff 配置
        console.log('Test buffs:');
        Object.keys(TestBuffConfigs).forEach(key => {
            console.log(`  ${key}:`, TestBuffConfigs[key]);
        });

        // 测试特效配置
        const fireballFxConfig = this.configLoader.getFxConfig('fireball');
        console.log('Fireball FX config:', fireballFxConfig);

        const allFxConfigs = this.configLoader.getAllFxConfigs();
        console.log(`Total FX configs: ${allFxConfigs.length}`);

        // 测试音频配置
        const hitAudioConfig = this.configLoader.getAudioConfig('hit');
        console.log('Hit audio config:', hitAudioConfig);

        const battleBGMConfig = this.configLoader.getAudioConfig('battle_bgm');
        console.log('Battle BGM config:', battleBGMConfig);

        const allAudioConfigs = this.configLoader.getAllAudioConfigs();
        console.log(`Total audio configs: ${allAudioConfigs.length}`);
    }

    /**
     * 测试：触发特效（在指定位置）
     */
    public testPlayFxAtPosition(fxKey: string, x: number, y: number): void {
        const player = this.playerEntity;
        if (!player) return;

        const fxIntent = player.addComponent(FxIntentComponent) as FxIntentComponent;
        fxIntent.fxKey = fxKey;
        fxIntent.position = { x, y };

        console.log(`[SceneTestGame] Trigger FX at position: ${fxKey} at (${x}, ${y})`);
    }

    /**
     * 测试：触发特效（在实体位置）
     */
    public testPlayFxOnEntity(fxKey: string, targetEntityId?: number): void {
        const player = this.playerEntity;
        if (!player) return;

        const fxIntent = player.addComponent(FxIntentComponent) as FxIntentComponent;
        fxIntent.fxKey = fxKey;

        if (targetEntityId !== undefined) {
            // 在指定实体位置播放
            // 注意：World 没有 getEntityById，需要通过查询找到实体
            const targetEntity = this.enemyEntities.find(e => e && e.id === targetEntityId);
            if (targetEntity) {
                fxIntent.targetHandle = targetEntity.handle;
            } else if (player.id === targetEntityId) {
                // 如果是玩家自己，不需要设置 targetHandle（会在当前实体位置播放）
            }
        }
        // 如果未指定，则在当前实体位置播放

        console.log(`[SceneTestGame] Trigger FX on entity: ${fxKey}`);
    }

    /**
     * 测试：播放音效
     */
    public testPlaySFX(sfxKey: string, volume?: number): void {
        const player = this.playerEntity;
        if (!player) return;

        const audioIntent = player.addComponent(AudioIntentComponent) as AudioIntentComponent;
        audioIntent.sfxKey = sfxKey;
        if (volume !== undefined) {
            audioIntent.volume = volume;
        }

        console.log(`[SceneTestGame] Trigger SFX: ${sfxKey}, volume=${volume || 'default'}`);
    }

    /**
     * 测试：播放背景音乐
     */
    public testPlayBGM(bgmKey: string, loop: boolean = true, volume?: number): void {
        const player = this.playerEntity;
        if (!player) return;

        const audioIntent = player.addComponent(AudioIntentComponent) as AudioIntentComponent;
        audioIntent.bgmKey = bgmKey;
        audioIntent.bgmLoop = loop;
        if (volume !== undefined) {
            audioIntent.volume = volume;
        }

        console.log(`[SceneTestGame] Trigger BGM: ${bgmKey}, loop=${loop}, volume=${volume || 'default'}`);
    }

    /**
     * 测试：停止背景音乐
     */
    public testStopBGM(): void {
        if (this.audioDriver) {
            this.audioDriver.stopBGM();
            console.log('[SceneTestGame] BGM stopped');
        }
    }

    /**
     * 测试：保存游戏（到指定槽位）
     */
    public testSaveGame(slotIndex: number = 0): void {
        if (!this.saveSystem) {
            console.error('[SceneTestGame] SaveSystem not initialized');
            return;
        }

        const success = this.saveSystem.saveGame(slotIndex);
        if (success) {
            const saveInfo = this.saveSystem.getSaveInfo(slotIndex);
            if (saveInfo) {
                const date = new Date(saveInfo.timestamp);
                console.log(`[SceneTestGame] Game saved to slot ${slotIndex} at ${date.toLocaleTimeString()}, version: ${saveInfo.version}`);
            }
        } else {
            console.error(`[SceneTestGame] Failed to save game to slot ${slotIndex}`);
        }
    }

    /**
     * 测试：读取游戏（从指定槽位）
     */
    public testLoadGame(slotIndex: number = 0): void {
        if (!this.saveSystem) {
            console.error('[SceneTestGame] SaveSystem not initialized');
            return;
        }

        if (!this.saveSystem.hasSave(slotIndex)) {
            console.warn(`[SceneTestGame] No save file found in slot ${slotIndex}`);
            return;
        }

        // 读档：重建 World
        const newWorld = this.saveSystem.loadGame(slotIndex);
        if (!newWorld) {
            console.error(`[SceneTestGame] Failed to load game from slot ${slotIndex}`);
            return;
        }

        // 替换现有 World
        const oldWorld = this.world;
        this.world = newWorld;

        // 重新注册所有系统到新 World
        this.setupSystemsForWorld(newWorld);

        // 重新初始化 ViewManager（重建 View）
        this.viewManager.clear(); // 清空所有 View
        this.viewManager.setWorld(newWorld);

        // 更新调度器中的 World
        this.scheduler = new Scheduler(
            newWorld,
            this.commandBuffer,
            this.eventBus,
            {
                fixedDeltaTime: 1 / 60,
                maxAccumulator: 0.25
            }
        );

        // 重新注册系统到调度器
        this.setupSchedulerForSystems();

        // 查找恢复的玩家实体
        const playerQuery = newWorld.createQuery({
            all: [StatsComponent, LevelExperienceComponent]
        });
        const entities = playerQuery.getEntities();
        if (entities.length > 0) {
            // 优先选择有 InventoryComponent 的实体
            for (const entity of entities) {
                if (entity.getComponent(InventoryComponent)) {
                    this.playerEntity = entity;
                    break;
                }
            }
            if (!this.playerEntity && entities.length > 0) {
                this.playerEntity = entities[0];
            }

            // 重新查找敌人实体
            this.enemyEntities = [];
            const allEntitiesQuery = newWorld.createQuery({ all: [] });
            allEntitiesQuery.forEach(entity => {
                if (entity.name.startsWith('Enemy_')) {
                    this.enemyEntities.push(entity);
                }
            });

            // 为玩家实体重新创建 View（通过 NeedViewTag）
            if (this.playerEntity) {
                const viewLink = this.playerEntity.getComponent(ViewLinkComponent);
                if (viewLink && viewLink.prefabKey) {
                    this.playerEntity.addComponent(NeedViewTagComponent);
                }
            }

            // 为敌人实体重新创建 View
            this.enemyEntities.forEach(enemy => {
                const viewLink = enemy.getComponent(ViewLinkComponent);
                if (viewLink && viewLink.prefabKey) {
                    enemy.addComponent(NeedViewTagComponent);
                }
            });
        } else {
            console.warn('[SceneTestGame] No player entity found after loading');
        }

        // 销毁旧 World
        if (oldWorld) {
            oldWorld.destroy();
        }

        console.log(`[SceneTestGame] Game loaded from slot ${slotIndex}`);
    }

    /**
     * 测试：删除存档
     */
    public testDeleteSave(slotIndex: number = 0): void {
        if (!this.saveSystem) {
            console.error('[SceneTestGame] SaveSystem not initialized');
            return;
        }

        const success = this.saveSystem.deleteSave(slotIndex);
        if (success) {
            console.log(`[SceneTestGame] Save deleted from slot ${slotIndex}`);
        } else {
            console.error(`[SceneTestGame] Failed to delete save from slot ${slotIndex}`);
        }
    }

    /**
     * 测试：获取存档信息
     */
    public testGetSaveInfo(slotIndex: number = 0): void {
        if (!this.saveSystem) {
            console.error('[SceneTestGame] SaveSystem not initialized');
            return;
        }

        const saveInfo = this.saveSystem.getSaveInfo(slotIndex);
        if (saveInfo) {
            const date = new Date(saveInfo.timestamp);
            console.log(`[SceneTestGame] Save Info (Slot ${slotIndex}):`);
            console.log(`  Version: ${saveInfo.version}`);
            console.log(`  Timestamp: ${date.toLocaleString()}`);
            console.log(`  Entity Name: ${saveInfo.entityName || 'N/A'}`);
            if (saveInfo.gameTime !== undefined) {
                console.log(`  Game Time: ${saveInfo.gameTime.toFixed(2)}s`);
            }
        } else {
            console.log(`[SceneTestGame] No save file in slot ${slotIndex}`);
        }
    }

    /**
     * 为新 World 注册所有系统（读档后使用）
     */
    private setupSystemsForWorld(world: World): void {
        // 注册阶段 1 Fixed Systems
        world.registerSystem(MoveSystem);
        world.registerSystem(CombatSystem);
        world.registerSystem(DeathSystem);

        const destroySystem = world.registerSystem(DestroySystem);
        destroySystem.setCommandBuffer(this.commandBuffer);
        destroySystem.setEventBus(this.eventBus);

        // 注册阶段 2 Fixed Systems
        const inputSystem = world.registerSystem(InputSystem);
        inputSystem.setEventBus(this.eventBus);

        world.registerSystem(AISystem);

        const collisionSystem = world.registerSystem(CollisionSystem);
        collisionSystem.setEventBus(this.eventBus);

        world.registerSystem(BuffSystem);
        world.registerSystem(SkillSystem);
        world.registerSystem(CooldownSystem);

        const viewSpawnSystem = world.registerSystem(ViewSpawnSystem);
        viewSpawnSystem.setEventBus(this.eventBus);

        const animationEventSystem = world.registerSystem(AnimationEventSystem);
        animationEventSystem.setEventBus(this.eventBus);

        // 注册 Render Systems
        world.registerSystem(AnimationIntentSystem);

        const renderSyncSystem = world.registerSystem(RenderSyncSystem);
        renderSyncSystem.setCommandBuffer(this.commandBuffer);

        // 重新注册 SaveSystem
        this.saveSystem = world.registerSystem(SaveSystem);
        this.saveSystem.setConfigLoader(this.configLoader);
    }

    /**
     * 为调度器注册所有系统（读档后使用）
     */
    private setupSchedulerForSystems(): void {
        // 注册阶段 1 Fixed Systems
        this.scheduler.registerFixedSystem(MoveSystem);
        this.scheduler.registerFixedSystem(CombatSystem);
        this.scheduler.registerFixedSystem(DeathSystem);
        this.scheduler.registerFixedSystem(DestroySystem);

        // 注册阶段 2 Fixed Systems
        this.scheduler.registerFixedSystem(InputSystem);
        this.scheduler.registerFixedSystem(AISystem);
        this.scheduler.registerFixedSystem(CollisionSystem);
        this.scheduler.registerFixedSystem(BuffSystem);
        this.scheduler.registerFixedSystem(SkillSystem);
        this.scheduler.registerFixedSystem(CooldownSystem);
        this.scheduler.registerFixedSystem(ViewSpawnSystem);
        this.scheduler.registerFixedSystem(AnimationEventSystem);

        // 注册 Render Systems
        this.scheduler.registerRenderSystem(AnimationIntentSystem);
        this.scheduler.registerRenderSystem(RenderSyncSystem);
    }

    onDestroy() {
        // 清理资源（注意：先清空 Driver，再清空 ViewPool，最后清空 ResourceManager）
        if (this.fxDriver) {
            this.fxDriver.clear(); // 清理所有特效
        }
        if (this.audioDriver) {
            this.audioDriver.clear(); // 停止所有音频
        }
        if (this.viewManager) {
            this.viewManager.clear(); // 这会清空 ViewPool
        }
        if (this.resourceManager) {
            this.resourceManager.clear(); // 释放 Prefab 等资源
        }
        if (this.world) {
            this.world.destroy();
        }
        console.log('[SceneTestGame] Destroyed');
    }
}
