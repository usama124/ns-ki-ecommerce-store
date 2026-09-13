import * as migration_20260909_071400_init_lujain from './20260909_071400_init_lujain'
import * as migration_20260909_163800_footer_columns from './20260909_163800_footer_columns'
import * as migration_20260909_224200_inventory_and_fulfillment from './20260909_224200_inventory_and_fulfillment'
import * as migration_20260909_231100_variant_colors from './20260909_231100_variant_colors'
import * as migration_20260911_000000_sizes_colors_collections from './20260911_000000_sizes_colors_collections'
import * as migration_20260911_180000_single_garment_color from './20260911_180000_single_garment_color'
import * as migration_20260911_190000_multi_category_assignment from './20260911_190000_multi_category_assignment'

export const migrations = [
  {
    up: migration_20260909_071400_init_lujain.up,
    down: migration_20260909_071400_init_lujain.down,
    name: '20260909_071400_init_lujain',
  },
  {
    up: migration_20260909_163800_footer_columns.up,
    down: migration_20260909_163800_footer_columns.down,
    name: '20260909_163800_footer_columns',
  },
  {
    up: migration_20260909_224200_inventory_and_fulfillment.up,
    down: migration_20260909_224200_inventory_and_fulfillment.down,
    name: '20260909_224200_inventory_and_fulfillment',
  },
  {
    up: migration_20260909_231100_variant_colors.up,
    down: migration_20260909_231100_variant_colors.down,
    name: '20260909_231100_variant_colors',
  },
  {
    up: migration_20260911_000000_sizes_colors_collections.up,
    down: migration_20260911_000000_sizes_colors_collections.down,
    name: '20260911_000000_sizes_colors_collections',
  },
  {
    up: migration_20260911_180000_single_garment_color.up,
    down: migration_20260911_180000_single_garment_color.down,
    name: '20260911_180000_single_garment_color',
  },
  {
    up: migration_20260911_190000_multi_category_assignment.up,
    down: migration_20260911_190000_multi_category_assignment.down,
    name: '20260911_190000_multi_category_assignment',
  },
]
