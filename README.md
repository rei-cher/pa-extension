
# 🩺 Prior Authorization Autoupload Chrome Extension

## Overview

**Prior Authorization Autoupload** is a Chrome extension that automates the process of downloading, renaming, and uploading **Prior Authorization (PA)** fax confirmations from [CoverMyMeds](https://www.covermymeds.com) into the [EMA (Electronic Medical Assistant)](https://www.modmed.com/ema/) system. The extension reduces manual effort and ensures consistency and speed in handling authorization documents in medical workflows.

---

## 🚀 Features

As of version **1.0.0**, this extension performs the following actions:

1. **Monitors activity** on CoverMyMeds to detect PA confirmation pages or API responses.
2. **Extracts patient info** (first name, last name, DOB, and medication).
3. **Downloads and renames** the PA confirmation PDF using patient information.
4. **(Planned)** Uploads the PDF into EMA using patient-matching logic and automated submission.
5. **Sanitizes filenames** to ensure they are filesystem-safe.

---

## 🛡️ Permissions Used

The extension requires the following Chrome permissions:

| Permission             | Why It's Needed                                                                 |
|------------------------|---------------------------------------------------------------------------------|
| `tabs`                 | To detect current tab and monitor navigation.                                  |
| `cookies`              | To retrieve authenticated cookies for secure API requests.                     |
| `storage`              | Reserved for future settings and user preferences.                             |
| `downloads`            | To download and rename PA PDFs programmatically.                               |
| `scripting`            | Reserved for future injection (not currently used).                            |
| `webRequest`           | To intercept API responses from CoverMyMeds and extract PA data.               |
| `webNavigation`        | To listen for page transitions such as the confirmation view.                  |
| `declarativeNetRequest`| Enables CORS modification and secure access to cross-origin resources.         |

### Host Permissions

```json
"host_permissions": [
  "*://portal-services.covermymeds.com/*",
  "*://dashboard.covermymeds.com/*",
  "*://www.covermymeds.com/*",
  "*://*.ema.md/*"
]
```

---

## 📁 File Structure

```
📦extension-root/
 ┣ 📜 manifest.json
 ┣ 📜 README.md
 ┣ 📁 func/
 ┃ ┣ 📜 cmm-cookie.js         // (optional) Get auth cookie
 ┃ ┣ 📜 pt-pa-info.js         // Extract patient & drug info
 ┃ ┣ 📜 pa-downloader.js      // Download PDF + track completion
 ┃ ┗ 📜 pt-ema.js             // (Planned) EMA patient matching/upload
 ┗ 📜 background.js           // Core logic and event handling
```

---

## 📌 Limitations

- Currently only supports fax confirmations with status `PA Request - Sent to Plan`.
- Upload to EMA is in progress (available in future versions).
- Not all edge cases (compound names, invalid DOBs) are handled yet.
- Currently supports English-language pages only.

---

## 🛠️ Installation

Until it's published on the Chrome Web Store, you can install the extension manually:

1. Clone or download this repository.
2. Run your bundler (like Webpack) to produce `dist/background.bundle.js`.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer Mode**.
5. Click **"Load unpacked"** and select the root folder of this extension.

Once published:

- Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link will be added upon release).
- Click **"Add to Chrome"**.
- Confirm permissions.

---

## 🧠 Why Use This Extension?

This tool was created to:
- Help clinics and practices handle PAs faster.
- Automate document handling with fewer errors.
- Seamlessly tie together CoverMyMeds and EMA workflows.
- Reduce administrative burden on clinical staff.

---

## 👨‍⚕️ Author

**Pavel Drozdov**  
_Email: pavel.dev.drozdov@gmail.com_  
Open to collaboration and improvements from the open-source and healthcare automation community.

---

## 📃 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Pavel Drozdov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 💡 Contributing

If you find bugs or want to add features (e.g. EMA upload), feel free to submit a pull request or open an issue. All contributions are welcome!

