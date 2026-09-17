import * as migration_20260909_071400_init_lujain from './20260909_071400_init_lujain'
import * as migration_20260909_163800_footer_columns from './20260909_163800_footer_columns'
import * as migration_20260909_224200_inventory_and_fulfillment from './20260909_224200_inventory_and_fulfillment'
import * as migration_20260909_231100_variant_colors from './20260909_231100_variant_colors'
import * as migration_20260911_000000_sizes_colors_collections from './20260911_000000_sizes_colors_collections'
import * as migration_20260911_180000_single_garment_color from './20260911_180000_single_garment_color'
import * as migration_20260911_190000_multi_category_assignment from './20260911_190000_multi_category_assignment'
import * as migration_20260913_170000_cod_fee from './20260913_170000_cod_fee'
import * as migration_20260916_000000_media_prefix from './20260916_000000_media_prefix'
import * as migration_20260916_010000_media_sizes from './20260916_010000_media_sizes'
import * as migration_20260917_000000_cancellation_reason from './20260917_000000_cancellation_reason'

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
  {
    up: migration_20260913_170000_cod_fee.up,
    down: migration_20260913_170000_cod_fee.down,
    name: '20260913_170000_cod_fee',
  },
  {
    up: migration_20260916_000000_media_prefix.up,
    down: migration_20260916_000000_media_prefix.down,
    name: '20260916_000000_media_prefix',
  },
  {
    up: migration_20260916_010000_media_sizes.up,
    down: migration_20260916_010000_media_sizes.down,
    name: '20260916_010000_media_sizes',
  },
  {
    up: migration_20260917_000000_cancellation_reason.up,
    down: migration_20260917_000000_cancellation_reason.down,
    name: '20260917_000000_cancellation_reason',
  },
]
