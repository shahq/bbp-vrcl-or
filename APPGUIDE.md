# Beyond Bullet Points App Guide

This guide explains how to move through the Beyond Bullet Points app as an admin or guest. It is written as a practical operating manual for running and joining a workshop.

## What the App Is For

Beyond Bullet Points is a collaborative workshop canvas for turning project context into Act I story cards. The facilitator creates a session, prepares a Project Overview, generates or edits cards, and shares the session link with participants. Guests join the same session, add ideas, connect cards, take shared notes, and export the finished work.

The main screens are:

- **Login screen:** enter an admin password or join a session by code.
- **Admin Dashboard:** create, open, copy, export, and delete sessions.
- **Project Overview screen:** prepare the brief, upload sources, and generate the starting canvas.
- **Canvas screen:** collaborate on Act I cards, connections, notes, chat, timer, and exports.

## How to Access as Admin

1. Open `/login`.
2. Use the **Admin Login** form.
3. Enter the admin password. In local/demo configuration, the default shown by the app is `shazam!`.
4. After login, the app takes you to `/`, the **Admin Dashboard**.

An authenticated admin can open any session without entering the session password. Admin sessions are stored in the browser, so returning to `/login` may redirect straight to the dashboard until you log out.

## How to Access as Guest

Guests do not need the admin password.

There are two ways to join:

1. Open the full session link shared by the facilitator, such as `/bdo-xxxx`.
2. Or open `/login`, enter the session code in **Join Session**, and press **Enter Session**.

If the session is password protected, the guest sees a **Password Protected** screen before entering. The facilitator must provide the session password. After the password is accepted, the browser remembers it for that tab/session.

When joining a collaborative room, guests are asked for a display name and color. This profile controls the live presence avatar and cursor shown to other users.

## Admin Flow

1. Log in at `/login`.
2. On the **Admin Dashboard**, create a new session from the left sidebar.
3. Choose whether guests need a session password.
4. Copy the session URL, and copy the password if one was generated.
5. Open the session.
6. Complete the **Project Overview** setup:
   - rename the project if needed,
   - upload source documents,
   - generate or write the Project Overview,
   - add Additional Notes,
   - save changes,
   - generate the canvas.
7. Run the workshop on the **Canvas**:
   - add/edit/reorder cards,
   - connect cards into story threads,
   - use the shared timer,
   - monitor and disconnect active guests if necessary,
   - use notes and chat in the right panel.
8. Export the work using **Save Doc**, **Save Canvas**, or sidebar export controls.

Admins can use **Return to brief** from the canvas to revise the Project Overview. After a canvas already exists, **Save changes and regenerate cards** deletes the current cards and creates a fresh set from the updated brief, so use it only when you intend to replace the canvas.

## Guest Flow

1. Open the session link or join by session code from `/login`.
2. Enter the session password if prompted.
3. Enter a display name and choose a color.
4. If the facilitator is still setting up the session, wait on the setup screen. The canvas appears automatically when setup is complete.
5. On the canvas, collaborate by editing cards, adding new cards, drawing connections, using the shared notepad, and participating through chat.
6. Use **Save Doc** or **Save Canvas** if you need a local copy of the work.

Guests do not see the admin sidebar. In a protected session, guests can edit only after entering the correct session password. In an open session, editing is enabled without a password.

## Admin Screen

The Admin Dashboard is the admin home page at `/`.

Use it to:

- create a session from the left sidebar,
- require or skip a guest password,
- see all sessions and their status,
- open a session,
- copy newly created session URLs and passwords,
- delete sessions,
- log out.

Session status appears as **Onboarding** until the Project Overview setup has been completed and the canvas has been generated or opened. It appears as **Ready** once the session is ready for workshop use.

When a password-protected session is created, the generated password is shown once in the creation modal and may also appear in the dashboard if the browser still has it stored. If the dashboard says the password is not stored, create a new protected session or retrieve the password through the configured backend/admin process.

## Project Overview Screen

The Project Overview screen is the session setup and brief-editing workspace. Admins see it before a session is ready. Admins and permitted editors can return to it later from the canvas with **Return to brief**.

Use it to:

- rename the project,
- upload source documents,
- import a prior session ZIP with **Upload Session**,
- review uploaded document summaries and extracted text,
- add source summaries or full extracted text into the Project Overview or Additional Notes,
- write or edit the **Project Overview**,
- use right-panel chat/questionnaire support to draft the overview,
- export the overview as a Word document,
- save changes,
- generate or regenerate the canvas.

Typical setup:

1. Add a clear project name.
2. Upload any source files needed for context.
3. Expand each upload to inspect its summary, extracted text, and source note.
4. Click **Generate brief from uploads** if the uploaded material should become the first draft.
5. Edit the **Project Overview** until it gives enough context for card generation.
6. Add supporting details in **Additional Notes**.
7. Click **Save changes** to store the brief without generating cards.
8. Click **Save & Generate Canvas** to create the initial Act I cards.

For an existing canvas, **Save changes** updates only the brief. **Save changes and regenerate cards** replaces the current cards after confirmation.

## Canvas Screen

The Canvas screen is the shared workshop workspace. It contains the Act I board in the center, collaboration/status controls in the top bar, and notes/chat/card tools in the right panel.

The current Act I canvas columns are:

- **Setting**
- **Role**
- **Point A**
- **Point B**
- **Call to Action**
- **Story**

Use the canvas to:

- select a card by clicking it,
- double-click a card to edit it inline,
- press Enter to save an edit,
- press Escape to cancel an edit,
- drag cards to reorder them within a column,
- use the plus button under a column to add a card,
- use **Generate Idea** on an empty card,
- keep non-story cards close to the 90-character guide,
- delete cards from the card hover controls,
- connect cards with the colored connection ports,
- Shift-drag from a card body to start a card-to-card connection,
- double-click a connection port to remove related connections,
- assemble Story cards from connected Call to Action cards,
- export with **Save Doc** or **Save Canvas**.

The top bar shows:

- active users and connection status,
- help/tutorial access,
- the shared timer,
- **Return to brief** or **Return to canvas** when available,
- **Exit Session** for admins.

Timer control defaults to admin-only. If the session timer mode is set to everyone, guests can also start, pause, reset, or edit the timer. The default timer duration is 90 seconds.

## Right Panel on the Canvas

The right panel has three tabs:

- **Notepad:** shared session notes that auto-save and are included in exports.
- **Cards:** details for the selected card, per-card notes, and an AI action to synthesize a note into a new card.
- **Chat:** AI-assisted workspace chat using the current session, brief, attachments, and selected-card context.

Use **Notepad** for workshop decisions, follow-ups, and shared notes. Use **Cards** after selecting a specific card when you want to capture details or create a related card from a note. Use **Chat** when you need help refining ideas against the project context.

## Collaboration Notes

- Live presence, cursors, card updates, connections, notes, and timer state sync through the realtime room.
- The admin sidebar shows connected guest users and can send a disconnect request.
- Guests have a simpler layout with no admin sidebar.
- If the connection badge shows disconnected, edits may not sync live until the realtime connection recovers.
- Exports should be treated as the handoff artifact when a workshop is complete. Use **Save Doc** for the full canvas DOCX, **Save Canvas** for a restorable ZIP archive, and the project brief **Download DOC** action for the onboarding overview DOCX. Markdown and JSON exports remain API-compatible handoff options for integrations that expose those links.
