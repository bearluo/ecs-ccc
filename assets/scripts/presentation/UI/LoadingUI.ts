import { _decorator, Component, Node, ProgressBar } from 'cc';
import { UIManager } from './UIManager';
import { ServiceLocator } from '../../app/ServiceLocator';
const { ccclass, property } = _decorator;
@ccclass('LoadingUI')
export class LoadingUI extends Component {
    @property(ProgressBar)
    progressBar: ProgressBar | null = null;
    
    private uiManager: UIManager | null = null;

    protected onLoad(): void {
        // 获取 UIManager
        this.uiManager = ServiceLocator.require(UIManager);
        this.uiManager.registerUI('LoadingUI', this);
        this.node.active = false; // 默认隐藏
    }

    start() {
    }
    update(deltaTime: number) {
    }
    /**
     * 设置进度条进度
     * @param progress 0-1
     */
    public setProgress(progress: number) {
        if (this.progressBar) {
            this.progressBar.progress = progress;
        }
    }
}