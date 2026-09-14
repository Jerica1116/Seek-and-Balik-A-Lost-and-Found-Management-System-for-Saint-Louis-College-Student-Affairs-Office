# Lost-and-Found Backend

## Run the backend server

### 1. Open PowerShell in the backend folder
```powershell
cd "c:\Users\Rome Dominic Rillera\OneDrive\Desktop\WITH DB\WITH_DB\LF\backend"
```

### 2. Activate the virtual environment
```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run this once for the current terminal session:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 3. Start the Django server
```powershell
python manage.py runserver
```

The backend should be available at:
```text
http://127.0.0.1:8000
```

## Setup once the first time
```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install django djangorestframework djangorestframework-simplejwt django-cors-headers django-environ psycopg2-binary pillow
.\.venv\Scripts\python.exe manage.py migrate
```

## Notes
- This project is configured to use the local SQLite database by default for development.
- If you want to use PostgreSQL instead, update the environment variables in the project root `.env` file and set `USE_SQLITE=False`.

## Photo uploads (up to 3 per item)

Each `ItemDetails` can have up to **3** photos, stored as separate `ItemImage`
rows (FK'd to the item) rather than a single field, so all 3 actually persist
instead of only the last one uploaded. `MAX_IMAGES_PER_ITEM = 3` is defined in
both `models.py` and `views.py` — keep them in sync if this ever changes.

**Create** (`POST` to create an item): send each photo as a repeated `image`
field in the multipart form. The server caps this at 3 server-side, so
extra files beyond the 3rd are silently ignored.

**Edit** (`PUT` to update an item): the request can include two optional
fields to control the item's photo set —
- `keep_image_ids` — a JSON-stringified array of existing `ItemImage` ids to
  retain (e.g. `"[4, 7]"`). Any existing photo *not* in this list is deleted.
  **Omit this field entirely to leave existing photos untouched** (this is
  the safe default for any caller that isn't photo-aware).
- `image` — new files to add, repeated the same way as on create. These fill
  whatever slots remain up to 3 total *after* the keep/delete step above.

If the frontend doesn't yet send `keep_image_ids`, edits will only ever add
photos (up to the cap) and never remove an existing one — removal requires
the frontend to track which existing image ids the user left checked and
send that list back.

## Django Admin Account
- admin123
- admin12345
