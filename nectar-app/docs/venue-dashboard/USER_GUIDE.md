# Venue Dashboard — User Guide

## Table of Contents

1. [Login Process](#login-process)
2. [Navigating the Dashboard](#navigating-the-dashboard)
3. [Viewing Transactions](#viewing-transactions)
4. [Configuring Queue Skips](#configuring-queue-skips)
5. [Using Panic Off](#using-panic-off)
6. [Editing Your Venue Profile](#editing-your-venue-profile)
7. [Uploading a Cover Image](#uploading-a-cover-image)
8. [Exporting Data](#exporting-data)

---

## Login Process

1. Navigate to the Nectar App in your browser.
2. In the top navigation bar, click **"For Venues"** to switch to venue side.
3. You will be taken to the **Venue Manager Login** page.
4. Enter your **email** and **password**, then click **Sign in**.
5. Upon successful login, you will be redirected to the **Transactions** page of your dashboard.

**Troubleshooting:**

- If you see "Invalid login credentials," double-check your email and password.
- If you've forgotten your password, contact your Nectar administrator for a reset.
- If you are logged in but see a "Not Found" page, your account may not be linked to a venue yet — contact support.

---

## Navigating the Dashboard

Once logged in, the dashboard has two parts:

- **Top bar:** Displays your venue name and a logout button.
- **Sidebar (left):** Navigation links to the three main sections:
  - **Transactions** — View and filter your sales history
  - **Queue Skip** — Configure pricing, days, and time slots
  - **Venue Card** — Edit your venue profile and cover image

Click any sidebar link to switch between sections. To return to the patron-facing site, use the **"Skip The Line"** toggle in the main navigation bar.

---

## Viewing Transactions

The **Transactions** page shows a log of all queue skip purchases for your venue.

### Filters

At the top of the page, you can filter transactions by:

- **Status:** Show all transactions or only paid ones.
- **Date range:** Set a start and/or end date to narrow results.
- **Search:** Type a customer name or email to search.
- **Rows per page:** Choose 25, 50, or 100 rows per page.

Click **Clear** to reset all filters.

### Transaction Table

The table displays:

| Column         | Description                              |
| -------------- | ---------------------------------------- |
| Customer Email | The buyer's email address                |
| Customer Name  | The buyer's name                         |
| Payment Status | Current status (e.g., "paid", "pending") |
| Amount         | The total amount charged                 |
| Date           | When the transaction was created         |

### Pagination

Use the **Previous** and **Next** buttons at the bottom to navigate between pages. The current page and total count are shown.

### Live Updates

The transaction table automatically refreshes every few seconds. When new purchases come in, they will appear without you needing to manually reload the page.

---

## Configuring Queue Skips

The **Queue Skip** page lets you manage your queue skip pricing and availability schedule.

### Setting the Price

At the top of the page, you'll see the **current price** for a queue skip.

1. Enter a new price in the input field.
2. Click **Save** to update.

The new price takes effect immediately for all future purchases.

### Managing Days

Below the price, you'll see your configured **days of the week**. Each day card shows:

- The day name (e.g., "Friday")
- The number of slots per hour
- The time slots configured for that day

**Adding a day:**

1. Click **Add Day**.
2. Select the day of the week.
3. Set the slots per hour (how many queue skips can be sold per hour).
4. Click **Save**.

**Removing a day:**

1. Click the **delete** button on the day card.
2. Confirm the deletion.

This removes the day and all its time slots.

### Managing Time Slots

Each day can have multiple time slots (e.g., "10:00 PM – 2:00 AM").

**Adding a time slot:**

1. On the day card, click **Add Time Slot**.
2. Set the start time and end time.
3. If the slot crosses midnight (e.g., 11 PM – 3 AM), enable **Crosses Midnight**.
4. Optionally set a custom slot count (overrides the day's default).
5. Click **Save**.

**Editing a time slot:**

1. Click the edit icon on the time slot.
2. Modify the times or settings.
3. Click **Save**.

**Deleting a time slot:**

1. Click the delete icon on the time slot.
2. Confirm the deletion.

**Note:** Time slots cannot overlap on the same day. The system will reject overlapping configurations.

---

## Using Panic Off

The **Panic Off** button is an emergency toggle at the bottom of the Queue Skip page.

### What It Does

When activated (queue skips disabled):

- A red banner appears: **"Queue skip purchases are currently DISABLED"**
- Patrons **cannot** purchase queue skips for your venue
- Your venue card on the patron feed will show "Currently Unavailable"

### How to Use

1. To **disable** queue skips: Click the **Panic Off** button and confirm.
2. To **re-enable** queue skips: Click the **Enable** button and confirm.

Use this when your venue is at capacity, during emergencies, or any time you need to immediately stop queue skip sales.

---

## Editing Your Venue Profile

The **Venue Card** page lets you update the information displayed on your venue's patron-facing card.

### Profile Form

You can edit:

- **Venue name** — Displayed on the venue card
- **Description** — A short summary shown below the venue name
- **Entry fee** — If your venue charges a separate entry fee
- **Price display mode** — Choose what pricing to show:
  - Queue skip price only
  - Entry fee only
  - Both prices

Click **Save** after making changes. A success notification will confirm the update.

### Live Preview

On the right side of the page (on desktop), a **preview card** shows how your venue will look to patrons in real-time as you make edits.

---

## Uploading a Cover Image

Below the profile form on the Venue Card page, you'll find the **image upload** section.

### How to Upload

1. Click the upload area or drag and drop an image file.
2. The image will upload to your venue's storage.
3. Once complete, the new cover image appears in the preview.

### Guidelines

- Supported formats: JPEG, PNG, WebP
- Recommended dimensions: at least 800px wide for best quality
- The image is cropped to fit the venue card's cover area (landscape orientation works best)

---

## Exporting Data

On the Transactions page, you can export your transaction data.

### How to Export

1. Apply any desired filters (date range, status, search).
2. Click the **Export** button in the top-right corner.
3. A CSV file will download containing all matching transactions.

The exported file includes: session ID, customer email, customer name, payment status, amount, and date.

**Note:** The export respects your current filters — only the filtered results are included.

---

## Logging Out

To log out of the dashboard:

1. Click the **Logout** button in the top-right corner of the dashboard navigation bar.
2. You will be redirected to the venue login page.

Your session will be cleared. You'll need to sign in again to access the dashboard.
