export interface Enchantment {
  id: string;
  level: number;
}

export interface ModData {
  modName: string;
  explanation: string;
  enchantments: Enchantment[];
  behaviorPack: {
    manifest: string;
    item: string;
  };
  resourcePack: {
    manifest: string;
    items: string;
    textures: {
      item_texture: string;
    };
  };
  scripts: {
    main: string;
  };
  texture_svg: string;
  pack_icon_base64: string;
}

export type OutputTab = 'explanation' | 'code' | 'download' | 'reviews';
