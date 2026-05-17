const supabase = require('../config/supabaseClient')

// Create a new session when farmer dials in
const createSession = async (sessionId, phoneNumber) => {
  const { error } = await supabase
    .from('ussd_sessions')
    .upsert({
      session_id: sessionId,
      phone_number: phoneNumber,
      current_step: 'main_menu',
      collected_data: {},
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    })

  if (error) {
    console.log('Session create error:', error.message)
  }
}

// Update session as farmer moves through menu
const updateSession = async (sessionId, step, collectedData) => {
  const { error } = await supabase
    .from('ussd_sessions')
    .update({
      current_step: step,
      collected_data: collectedData,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    })
    .eq('session_id', sessionId)

  if (error) {
    console.log('Session update error:', error.message)
  }
}

// Mark session as completed
const completeSession = async (sessionId) => {
  const { error } = await supabase
    .from('ussd_sessions')
    .update({
      status: 'completed',
      current_step: 'completed'
    })
    .eq('session_id', sessionId)

  if (error) {
    console.log('Session complete error:', error.message)
  }
}

// Mark session as abandoned
const abandonSession = async (sessionId) => {
  const { error } = await supabase
    .from('ussd_sessions')
    .update({ status: 'abandoned' })
    .eq('session_id', sessionId)

  if (error) {
    console.log('Session abandon error:', error.message)
  }
}

// Clean up expired sessions
const cleanExpiredSessions = async () => {
  const { error } = await supabase
    .from('ussd_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'active')

  if (error) {
    console.log('Session cleanup error:', error.message)
  } else {
    console.log('Expired sessions cleaned up')
  }
}

module.exports = {
  createSession,
  updateSession,
  completeSession,
  abandonSession,
  cleanExpiredSessions
}