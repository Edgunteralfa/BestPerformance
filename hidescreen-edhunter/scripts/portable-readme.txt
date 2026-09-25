BestPerformance — portable

Распакуйте архив на флешку. Рядом с BestPerformance.exe должен остаться пустой файл portable. Его не удаляйте: по нему программа понимает, что заметки нужно хранить рядом с собой, в папке data, а не в профиле Windows.

Как забрать заметки с компьютера, где BestPerformance уже стоит

Закройте установленную программу крестиком. Пока она открыта, запуск с флешки только покажет уже открытое окно.

Запустите BestPerformance.exe с флешки. Если папки data ещё нет, программа один раз копирует заметки этого компьютера. Дальше флешка хранит свою копию и на других ноутбуках её не перезаписывает.

Если папка data уже появилась, а нужных записей в ней нет, перенос вручную:

1. Закройте программу.
2. Скопируйте файл
   %APPDATA%\com.hidescreen.app\config.json
3. Вставьте его в папку data рядом с BestPerformance.exe и замените тамошний config.json.
4. Снова запустите программу с флешки.

Установленную программу после этого не удаляйте с галочкой «удалить данные», если хотите оставить заметки и на компьютере.

---

Unpack the archive onto a flash drive. Leave the empty file named portable next to BestPerformance.exe. That file tells the app to keep notes in the data folder beside the program, not in the Windows profile.

To bring notes from a computer where BestPerformance is already installed, close that copy with the X button first. While it is open, starting the flash-drive copy only shows the window that is already running.

Then start BestPerformance.exe from the drive. If the data folder is not there yet, the app copies this computer's notes once. After that the drive keeps its own copy and does not replace it on the next computer.

If data already exists and the notes you want are missing, copy them by hand:

1. Close the app.
2. Copy
   %APPDATA%\com.hidescreen.app\config.json
3. Paste it into the data folder next to BestPerformance.exe, replacing config.json there.
4. Start the app from the drive again.

Do not uninstall the installed copy with "delete application data" checked if you still want those notes on the computer.
