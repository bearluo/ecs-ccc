import { SpriteFrame, Texture2D } from "cc";


export function createSpriteFrame(texture: Texture2D | null): SpriteFrame | null {
    if (!texture) {
        return null;
    }
    const spriteFrame = new SpriteFrame();
    spriteFrame.texture = texture;
    return spriteFrame;
}