import * as migration_20260909_071400_init_lujain from './20260909_071400_init_lujain'
import * as migration_20260909_163800_footer_columns from './20260909_163800_footer_columns'

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
]
