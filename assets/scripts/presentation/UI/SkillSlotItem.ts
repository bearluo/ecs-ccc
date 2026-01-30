/**
 * 技能槽位
 * 
 * 显示技能信息，支持技能使用
 */

import { Component, _decorator, Label, Sprite, ProgressBar } from 'cc';
import { MVVMComponent, toLabelText, toProgress } from '@bl-framework/mvvm-creator';
import { Model, ViewModel } from '@bl-framework/mvvm';

const { ccclass, property } = _decorator;

interface SkillSlotItemModel {
    cooldown: number;
    maxCooldown: number;
}

@ccclass('SkillSlotItem')
export class SkillSlotItem extends MVVMComponent<SkillSlotItemModel> {


    @property(Sprite)
    iconSprite: Sprite | null = null;

    @property(Label)
    cooldownLabel: Label | null = null;

    @property(ProgressBar)
    cooldownProgressBar: ProgressBar | null = null;

    
    private clickCallback: (() => void) | null = null;

    protected createModel(): Model<SkillSlotItemModel> {
        return new Model<SkillSlotItemModel>({
            cooldown: 0,
            maxCooldown: 0,
        });
    }

    protected initViewModel(model: Model<SkillSlotItemModel>): ViewModel<SkillSlotItemModel> {
        return new ViewModel<SkillSlotItemModel>(model);
    }

    protected onMVVMCreate(): void {
        this.bindingBuilder.bind('cooldown', toLabelText(this.cooldownLabel), { converter:(cooldown) => cooldown > 0 ? cooldown.toFixed(1) : '' } );

        const progressBarConverter = () => {
            const value = this.viewModel.reactive.value;
            return value.maxCooldown > 0 ? value.cooldown / value.maxCooldown : 0;
        };
        this.bindingBuilder.bind("cooldown", toProgress(this.cooldownProgressBar), { converter:progressBarConverter } );

        this.bindingBuilder.build();
    }

    set cooldown(cooldown: number) {
        this.viewModel.reactive.value.cooldown = cooldown;
    }

    set maxCooldown(maxCooldown: number) {
        this.viewModel.reactive.value.maxCooldown = maxCooldown;
    }

    setClickCallback(callback: () => void) {
        this.clickCallback = callback;
    }

    onButtonClick() {
        if (this.clickCallback) {
            this.clickCallback();
        }
    }
}
