mod db;
mod commands;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
  pub db: Mutex<rusqlite::Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle();
      let conn = db::init_db(&handle).expect("failed to initialize database");
      app.manage(AppState {
        db: Mutex::new(conn),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::tree::get_tree_snapshot,
      commands::notes::get_note,
      commands::notes::update_note,
      commands::notes::create_sibling,
      commands::notes::create_child,
      commands::notes::rename_note,
      commands::notes::soft_delete_note,
      commands::notes::toggle_pin_note,
      commands::search::search_notes,
      commands::move_note::move_note,
      commands::open::mark_open,
      commands::open::touch_open,
      commands::open::get_open_list,
      commands::trash::get_deleted_notes,
      commands::trash::restore_note,
      commands::trash::hard_delete_note,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
