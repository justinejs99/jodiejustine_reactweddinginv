import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// GET /api/wedding?group=1
app.get('/api/wedding', async (req, res) => {
  const groupId = Number(req.query.group) || 1;

  try {
    const [coupleRows] = await pool.query('SELECT * FROM couple LIMIT 1');
    const [dateRows] = await pool.query('SELECT * FROM wedding_date LIMIT 1');
    const [scheduleRows] = await pool.query('SELECT * FROM schedule ORDER BY sort_order');
    const [rsvpRows] = await pool.query('SELECT * FROM rsvp_config LIMIT 1');
    const [contactRows] = await pool.query('SELECT * FROM contact LIMIT 1');
    const [responseRows] = await pool.query('SELECT * FROM responses');
    const [qrRows] = await pool.query('SELECT * FROM qr_config LIMIT 1');
    const [groupRows] = await pool.query('SELECT * FROM guest_groups WHERE id = ?', [groupId]);
    const [guestRows] = await pool.query('SELECT * FROM guests WHERE group_id = ?', [groupId]);

    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'Guest group not found' });
    }

    const couple = coupleRows[0];
    const date = dateRows[0];
    const rsvp = rsvpRows[0];
    const contact = contactRows[0];
    const qr = qrRows[0];
    const group = groupRows[0];
    const accepted = responseRows.find(r => r.type === 'accepted');
    const declined = responseRows.find(r => r.type === 'declined');

    res.json({
      couple: {
        groomName: couple.groom_name,
        groomLastName: couple.groom_last_name,
        groomParents: couple.groom_parents,
        brideName: couple.bride_name,
        brideLastName: couple.bride_last_name,
        brideParents: couple.bride_parents,
        hashtag: couple.hashtag,
        verse: couple.verse,
      },
      invitation: {
        groupId: group.id,
        validPax: guestRows.length,
        guestGroupName: group.group_name,
        guests: guestRows.map(g => ({
          id: g.id,
          designation: g.designation,
          firstName: g.first_name,
          lastName: g.last_name,
          attendance: g.attendance,
          tableNo: g.table_no,
          seatNo: g.seat_no,
        })),
      },
      schedule: scheduleRows.map(s => ({
        time: s.time,
        title: s.title,
        subtitle: s.subtitle || undefined,
        venue: s.venue,
        location: s.location,
      })),
      weddingDate: {
        dateText: date.date_text,
        weekday: date.weekday,
      },
      rsvp: {
        deadline: rsvp.deadline,
      },
      contact: {
        display: contact.display,
        whatsAppUrl: contact.whatsapp_url,
      },
      responses: {
        accepted: { title: accepted.title, body: accepted.body },
        declined: { title: declined.title, body: declined.body },
      },
      qr: {
        message: qr.message,
      },
      integration: {
        modeLabel: 'MySQL database',
      },
    });
  } catch (error) {
    console.error('Error fetching wedding content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rsvp
app.post('/api/rsvp', async (req, res) => {
  const { attendance, guestIds, groupId } = req.body;
  const safeGroupId = Number(groupId) || 1;

  if (!attendance || !['yes', 'no'].includes(attendance)) {
    return res.status(400).json({ error: 'Invalid attendance value' });
  }

  try {
    // Reset all guests in the group to Pending before recording new response
    await pool.query(
      'UPDATE guests SET attendance = ? WHERE group_id = ?',
      ['Pending', safeGroupId]
    );

    if (attendance === 'yes') {
      if (!Array.isArray(guestIds) || guestIds.length === 0) {
        return res.status(400).json({ error: 'At least one guest must be selected' });
      }

      // Set selected guests to Yes
      await pool.query(
        'UPDATE guests SET attendance = ? WHERE id IN (?) AND group_id = ?',
        ['Yes', guestIds.map(Number), safeGroupId]
      );

      // Set unselected guests in the same group to No
      await pool.query(
        'UPDATE guests SET attendance = ? WHERE id NOT IN (?) AND group_id = ?',
        ['No', guestIds.map(Number), safeGroupId]
      );
    } else {
      // Decline all guests in the group
      await pool.query(
        'UPDATE guests SET attendance = ? WHERE group_id = ?',
        ['No', safeGroupId]
      );
    }

    const attendingCount = attendance === 'yes' ? guestIds.length : 0;
    const message = attendance === 'yes'
      ? `Your RSVP for ${attendingCount} guest${attendingCount > 1 ? 's have' : ' has'} been saved.`
      : 'We have recorded your regret response.';

    res.json({
      success: true,
      message,
      referenceId: `RSVP-G${safeGroupId}`,
    });
  } catch (error) {
    console.error('Error submitting RSVP:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reception check-in endpoints ─────────────────────────────────────────────

// GET /api/reception/group?id=2
app.get('/api/reception/group', async (req, res) => {
  const groupId = Number(req.query.id);

  if (!groupId || isNaN(groupId) || groupId < 1) {
    return res.status(400).json({ error: 'Invalid group id' });
  }

  try {
    const [groupRows] = await pool.query(
      'SELECT * FROM guest_groups WHERE id = ?',
      [groupId]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'Guest group not found' });
    }

    const [guestRows] = await pool.query(
      'SELECT * FROM guests WHERE group_id = ?',
      [groupId]
    );

    const [checkinRows] = await pool.query(
      'SELECT * FROM checkin_records WHERE group_id = ?',
      [groupId]
    );

    const adults = guestRows.filter(g => g.designation !== 'Child');
    const kids = guestRows.filter(g => g.designation === 'Child');

    // Construct display name from first 2 adults, e.g. "Mr. Sinaga Gany & Mrs. Yuliani Thio"
    const displayParts = adults
      .slice(0, 2)
      .map(g => `${g.designation} ${g.first_name} ${g.last_name}`);
    const groupName = displayParts.length > 0
      ? displayParts.join(' & ')
      : groupRows[0].group_name;

    const tableNo = guestRows.length > 0 ? guestRows[0].table_no : null;
    const checkedIn = checkinRows.length > 0 ? Boolean(checkinRows[0].checked_in) : false;

    res.json({
      groupId: groupRows[0].id,
      groupName,
      tableNo,
      adultPax: adults.length,
      kidsPax: kids.length,
      checkedIn,
    });
  } catch (error) {
    console.error('Error fetching reception group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reception/checkin
app.post('/api/reception/checkin', async (req, res) => {
  const { groupId, adultCount, kidsCount, giftCount, souvenirCount, titipanGiftCount } = req.body;
  const safeGroupId = Number(groupId);

  if (!safeGroupId || isNaN(safeGroupId) || safeGroupId < 1) {
    return res.status(400).json({ error: 'Invalid group id' });
  }

  try {
    await pool.query(
      `INSERT INTO checkin_records
         (group_id, checked_in, checked_in_at, adult_count, kids_count, gift_count, souvenir_count, titipan_gift_count)
       VALUES (?, TRUE, NOW(), ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         checked_in       = TRUE,
         checked_in_at    = NOW(),
         adult_count      = VALUES(adult_count),
         kids_count       = VALUES(kids_count),
         gift_count       = VALUES(gift_count),
         souvenir_count   = VALUES(souvenir_count),
         titipan_gift_count = VALUES(titipan_gift_count)`,
      [
        safeGroupId,
        Number(adultCount) || 0,
        Number(kidsCount) || 0,
        Number(giftCount) || 0,
        Number(souvenirCount) || 0,
        Number(titipanGiftCount) || 0,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving check-in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Wedding API server running on http://localhost:${PORT}`);
});
