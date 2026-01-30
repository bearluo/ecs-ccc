/**
 * 背包物品槽位
 * 
 * 显示物品信息
 * 
 * 参考文档：memory-bank/creative/creative-ui-system.md
 */

import { Component, _decorator, Label, Sprite } from 'cc';
import { MVVMComponent, toLabelText, toSpriteFrame } from '@bl-framework/mvvm-creator';
import { Model, ViewModel } from '@bl-framework/mvvm';
import { ServiceLocator } from '../../app/ServiceLocator';
import { createSpriteFrame } from '../Utils/SpriteFrameUtil';
import { ResourceManager } from '../ResourceManager';

const { ccclass, property } = _decorator;

interface InventorySlotItemModel {
    itemId: string;
    count: number;
    icon: string;
    slotIndex: number;
}

@ccclass('InventorySlotItem')
export class InventorySlotItem extends MVVMComponent<InventorySlotItemModel> {


    @property(Sprite)
    iconSprite: Sprite | null = null;

    @property(Label)
    countLabel: Label | null = null;

    private clickCallback: (() => void) | null = null;

    protected createModel(): Model<InventorySlotItemModel> {
        return new Model<InventorySlotItemModel>({
            itemId: '',
            count: 0,
            icon: '',
            slotIndex: 0,
        });
    }

    protected initViewModel(model: Model<InventorySlotItemModel>): ViewModel<InventorySlotItemModel> {
        return new ViewModel<InventorySlotItemModel>(model);
    }

    protected onMVVMCreate(): void {
        this.bindingBuilder.bind('icon', toSpriteFrame(this.iconSprite), { converter:(icon: string) => createSpriteFrame(ServiceLocator.require(ResourceManager).getTexture(icon)) } );
        this.bindingBuilder.bind("count", toLabelText(this.countLabel), { converter:(count) => count > 0 ? count.toString() : '' } );


        this.bindingBuilder.build();
    }


    set itemId(itemId: string) {
        this.viewModel.reactive.value.itemId = itemId;
    }

    set count(count: number) {
        this.viewModel.reactive.value.count = count;
    }

    set icon(icon: string) {
        this.viewModel.reactive.value.icon = icon;
    }

    set slotIndex(slotIndex: number) {
        this.viewModel.reactive.value.slotIndex = slotIndex;
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
