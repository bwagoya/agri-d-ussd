const supabase = require('../config/supabaseClient')
const {
  createSession,
  updateSession,
  completeSession
} = require('../services/sessionService')

// Validation helpers
const isValidNumber = (value) => {
  return !isNaN(value) && Number(value) > 0
}

const isValidName = (value) => {
  return value && value.trim().length >= 2 && /^[a-zA-Z\s''-]+$/.test(value.trim())
}

const isValidLocation = (value) => {
  return value && value.trim().length >= 2
}

const isValidMenuChoice = (value, options) => {
  return options.includes(value.trim())
}

// Helper to check if farmer is registered
const isFarmerRegistered = async (phoneNumber) => {
  const { data } = await supabase
    .from('farmers')
    .select('phone_number')
    .eq('phone_number', phoneNumber)
    .single()
  return !!data
}

// Get current session step from Supabase
const getSessionStep = async (sessionId) => {
  const { data } = await supabase
    .from('ussd_sessions')
    .select('current_step, collected_data')
    .eq('session_id', sessionId)
    .single()
  return data
}

const crops = { '1': 'Maize', '2': 'Potatoes' }

const handleUssd = async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body
  const textArray = text.split('*')
  const userInput = textArray[textArray.length - 1].trim()
  let response = ''

  // Get current session state
  const session = await getSessionStep(sessionId)
  const currentStep = session?.current_step || 'new'
  const collectedData = session?.collected_data || {}

  console.log('Session ID:', sessionId)
  console.log('Current step:', currentStep)
  console.log('User input:', userInput)
  // Main menu — new session
  if (text === '' || currentStep === 'new') {
    await createSession(sessionId, phoneNumber)
    response = `CON Welcome to Agri-D Ledger\n1. List Produce\n2. Check My Listings\n3. View Prices\n4. Register`
    await updateSession(sessionId, 'main_menu', {})

  // Main menu selection
  } else if (currentStep === 'main_menu') {
    if (userInput === '1') {
      const registered = await isFarmerRegistered(phoneNumber)
      if (!registered) {
        response = `END Please register first.\nDial again and select\noption 4 to register.`
        await completeSession(sessionId)
      } else {
        response = `CON Select crop type:\n1. Maize\n2. Potatoes`
        await updateSession(sessionId, 'select_crop', {})
      }
    } else if (userInput === '2') {
      const { data, error } = await supabase
        .from('produce_listings')
        .select('crop_type, quantity, status')
        .eq('phone_number', phoneNumber)
        .limit(3)

      if (error || !data || data.length === 0) {
        response = `END You have no listings yet.`
      } else {
        let list = data.map(l => `${l.crop_type} - ${l.quantity} bags - ${l.status}`).join('\n')
        response = `END Your listings:\n${list}`
      }
      await completeSession(sessionId)
    } else if (userInput === '3') {
      response = `END Price checker coming soon.`
      await completeSession(sessionId)
    } else if (userInput === '4') {
      response = `CON Enter your full name:`
      await updateSession(sessionId, 'enter_name', { action: 'register' })
    } else {
      response = `CON Invalid option.\n1. List Produce\n2. Check My Listings\n3. View Prices\n4. Register`
    }

  // Select crop
  } else if (currentStep === 'select_crop') {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      response = `CON Invalid choice. Select crop type:\n1. Maize\n2. Potatoes`
    } else {
      const crop = crops[userInput]
      response = `CON ${crop} selected.\nEnter quantity (bags):`
      await updateSession(sessionId, 'enter_quantity', { cropType: crop })
    }

  // Enter quantity
  } else if (currentStep === 'enter_quantity') {
    if (!isValidNumber(userInput)) {
      response = `CON Invalid quantity. Must be a number > 0.\nEnter quantity (bags):`
    } else if (Number(userInput) > 10000) {
      response = `CON Max is 10,000 bags.\nEnter quantity (bags):`
    } else {
      await updateSession(sessionId, 'enter_price', {
        ...collectedData,
        quantity: userInput
      })
      response = `CON Enter your asking price per bag (KES):`
    }

  // Enter price
  } else if (currentStep === 'enter_price') {
    if (!isValidNumber(userInput)) {
      response = `CON Invalid price. Must be a number > 0.\nEnter price per bag (KES):`
    } else if (Number(userInput) < 100) {
      response = `CON Min price is KES 100.\nEnter price per bag (KES):`
    } else if (Number(userInput) > 100000) {
      response = `CON Max price is KES 100,000.\nEnter price per bag (KES):`
    } else {
      const quantity = collectedData.quantity
      const price = userInput
      const crop = collectedData.cropType
      const total = (Number(quantity) * Number(price)).toLocaleString()
      response = `CON Summary:\nCrop: ${crop}\nQty: ${quantity} bags\nPrice: KES ${price}/bag\nTotal: KES ${total}\n\n1. Confirm\n2. Cancel`
      await updateSession(sessionId, 'confirm_listing', {
        ...collectedData,
        price: userInput
      })
    }

  // Confirm listing
  } else if (currentStep === 'confirm_listing') {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      const quantity = collectedData.quantity
      const price = collectedData.price
      const crop = collectedData.cropType
      const total = (Number(quantity) * Number(price)).toLocaleString()
      response = `CON Invalid choice.\nCrop: ${crop}\nQty: ${quantity} bags\nPrice: KES ${price}/bag\nTotal: KES ${total}\n\n1. Confirm\n2. Cancel`
    } else if (userInput === '1') {
      const listingId = `LST-${Date.now()}`
      const { error } = await supabase
        .from('produce_listings')
        .insert({
          listing_id: listingId,
          phone_number: phoneNumber,
          crop_type: collectedData.cropType,
          quantity: parseFloat(collectedData.quantity),
          asked_price: parseFloat(collectedData.price),
          status: 'pending'
        })

      if (error) {
        console.log('Listing error:', error.message)
        response = `END Something went wrong. Please try again.`
      } else {
        response = `END Listing submitted!\nRef: ${listingId}\n\nYou will be notified when verified.`
        await completeSession(sessionId)
      }
    } else {
      response = `END Listing cancelled.`
      await completeSession(sessionId)
    }

  // Enter name (registration)
  } else if (currentStep === 'enter_name') {
    if (!isValidName(userInput)) {
      response = `CON Invalid name. Letters only, min 2 characters.\nEnter your full name:`
    } else {
      response = `CON Enter your location:`
      await updateSession(sessionId, 'enter_location', {
        action: 'register',
        name: userInput
      })
    }

  // Enter location (registration)
  } else if (currentStep === 'enter_location') {
    if (!isValidLocation(userInput)) {
      response = `CON Invalid location. Min 2 characters.\nEnter your location:`
    } else {
      const name = collectedData.name
      const location = userInput

      const { error } = await supabase
        .from('farmers')
        .upsert({
          phone_number: phoneNumber,
          name: name,
          location: location
        })

      if (error) {
        console.log('Registration error:', error.message)
        response = `END Registration failed. Please try again.`
      } else {
        response = `END Registration successful!\nName: ${name}\nLocation: ${location}\n\nDial again to list your produce.`
        await completeSession(sessionId)
      }
    }

  } else {
    response = `END Invalid option. Please try again.`
    await completeSession(sessionId)
  }

  res.set('Content-Type', 'text/plain')
  res.send(response)
}

module.exports = { handleUssd }