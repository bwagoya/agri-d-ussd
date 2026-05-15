# Agri-D Ledger — USSD Module

## Overview
USSD interface for farmers built with Node.js, Express, and Supabase.
Handles farmer registration and produce listings via Africa's Talking.

## Live URL
https://agri-d-ussd.onrender.com

## API Endpoints

### POST /ussd/callback
Africa's Talking USSD callback endpoint.

**Request (form-urlencoded):**
| Field | Type | Description |
|---|---|---|
| sessionId | string | Africa's Talking session ID |
| serviceCode | string | USSD service code |
| phoneNumber | string | Farmer's phone number |
| text | string | Accumulated menu inputs |

**Response:** `text/plain` starting with `CON` (continue) or `END` (terminate)

---

### POST /api/listings
Called by team backend to notify USSD module of listing updates.

**Request (JSON):**
```json
{
  "listingId": "LST-1234567890",
  "status": "verified",
  "suggestedPrice": 3200,
  "riskLevel": "LOW"
}
```

---

## Database Tables (Supabase PostgreSQL)

### farmers
| Column | Type | Description |
|---|---|---|
| phone_number | TEXT (PK) | Farmer's phone number |
| name | TEXT | Full name |
| location | TEXT | Farm location |
| farm_size | TEXT | Size of farm |
| is_verified | BOOLEAN | Verification status |
| registered_at | TIMESTAMPTZ | Registration timestamp |

### ussd_sessions
| Column | Type | Description |
|---|---|---|
| session_id | TEXT (PK) | Africa's Talking session ID |
| phone_number | TEXT (FK) | Farmer's phone number |
| current_step | TEXT | Current menu step |
| collected_data | JSONB | Accumulated input data |
| status | TEXT | active/completed/expired |
| created_at | TIMESTAMPTZ | Session start time |
| expires_at | TIMESTAMPTZ | Session expiry time |

### produce_listings
| Column | Type | Description |
|---|---|---|
| listing_id | TEXT (PK) | Unique listing reference |
| phone_number | TEXT (FK) | Farmer's phone number |
| crop_type | TEXT | maize or potatoes |
| quantity | NUMERIC | Quantity in bags |
| unit | TEXT | Default: bags |
| location | TEXT | Storage location |
| asked_price | NUMERIC | Farmer's asking price (KES) |
| suggested_price | NUMERIC | ML module fills this |
| status | TEXT | pending/verified/sold/expired |
| iot_verified | BOOLEAN | IoT module fills this |
| blockchain_recorded | BOOLEAN | Blockchain module fills this |
| listed_at | TIMESTAMPTZ | Listing timestamp |

---

## Integration Points

### When a farmer confirms a listing
module receives a POST to this endpoint: