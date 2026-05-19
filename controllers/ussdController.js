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

const handleUssd = async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body
  const textArray = text.split('*')
  const userInput = textArray[textArray.length - 1].trim()
  console.log('Full text:', text)
  console.log('Text array length:', textArray.length)
  console.log('User input:', userInput)
  let response = ''

  // Main menu
  if (text === '') {
    await createSession(sessionId, phoneNumber)
    response = `CON Welcome to Agri-D Ledger\n1. List Produce\n2. Check My Listings\n3. View Prices\n4. Register`
    await updateSession(sessionId, 'main_menu', {})

  // Option 1 - List Produce
  } else if (text === '1') {
    const registered = await isFarmerRegistered(phoneNumber)
    if (!registered) {
      response = `END Please register first.\nDial again and select\noption 4 to register.`
      await completeSession(sessionId)
    } else {
      response = `CON Select crop type:\n1. Maize\n2. Potatoes`
      await updateSession(sessionId, 'select_crop', { action: 'list' })
    }

  // Option 1 - Crop selected
  } else if (textArray.length === 2 && textArray[0] === '1') {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      response = `CON Invalid choice. Select crop type:\n1. Maize\n2. Potatoes`
    } else {
      const crops = { '1': 'Maize', '2': 'Potatoes' }
      const crop = crops[userInput]
      response = `CON ${crop} selected.\nEnter quantity (bags):`
      await updateSession(sessionId, 'enter_quantity', { action: 'list', cropType: crop })
    }

  // Option 1 - Quantity entered
  } else if (textArray.length === 3 && textArray[0] === '1') {
    if (!isValidMenuChoice(textArray[1], ['1', '2'])) {
      response = `END Invalid crop selection. Please start again.`
      await completeSession(sessionId)
    } else if (!isValidNumber(userInput)) {
      response = `CON Invalid quantity. Must be a number > 0.\nEnter quantity (bags):`
    } else if (Number(userInput) > 10000) {
      response = `CON Max is 10,000 bags.\nEnter quantity (bags):`
    } else {
      const crops = { '1': 'Maize', '2': 'Potatoes' }
      response = `CON Enter your asking price per bag (KES):`
      await updateSession(sessionId, 'enter_price', {
        action: 'list',
        cropType: crops[textArray[1]],
        quantity: userInput
      })
    }

  
// Option 1 - Price entered - show summary
  } else if (textArray.length >= 4 && textArray[0] === '1' && textArray.length < 6) {
    const crops = { '1': 'Maize', '2': 'Potatoes' }
    const crop = crops[textArray[1]]
    const quantity = textArray[2]
    const price = userInput

    if (!isValidNumber(price)) {
      response = `CON Invalid price. Must be a number > 0.\nEnter price per bag (KES):`
    } else if (Number(price) < 100) {
      response = `CON Min price is KES 100.\nEnter price per bag (KES):`
    } else if (Number(price) > 100000) {
      response = `CON Max price is KES 100,000.\nEnter price per bag (KES):`
    } else {
      const total = (Number(quantity) * Number(price)).toLocaleString()
      response = `CON Summary:\nCrop: ${crop}\nQty: ${quantity} bags\nPrice: KES ${price}/bag\nTotal: KES ${total}\n\n1. Confirm\n2. Cancel`
      await updateSession(sessionId, 'confirm_listing', {
        action: 'list',
        cropType: crop,
        quantity,
        price
      })
    }

  // Option 1 - Confirm listing
  } else if (textArray.length >= 5 && textArray[0] === '1' && isValidMenuChoice(userInput, ['1', '2'])) {
    if (!isValidMenuChoice(userInput, ['1', '2'])) {
      response = `CON Invalid choice.\n1. Confirm\n2. Cancel`
    } else if (userInput === '1') {
      const crops = { '1': 'Maize', '2': 'Potatoes' }
      const crop = crops[textArray[1]]
      const quantity = textArray[2]
      const price = textArray[3]
      const listingId = `LST-${Date.now()}`

      const { error } = await supabase
        .from('produce_listings')
        .insert({
          listing_id: listingId,
          phone_number: phoneNumber,
          crop_type: crop,
          quantity: parseFloat(quantity),
          asked_price: parseFloat(price),
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

  // Option 2 - Check My Listings
  } else if (text === '2') {
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

  // Option 3 - View Prices
  } else if (text === '3') {
    response = `END Price checker coming soon.`
    await completeSession(sessionId)

  // Option 4 - Register - enter name
  } else if (text === '4') {
    response = `CON Enter your full name:`
    await updateSession(sessionId, 'enter_name', { action: 'register' })

  // Option 4 - Enter location
  } else if (textArray.length === 2 && textArray[0] === '4') {
    if (!isValidName(userInput)) {
      response = `CON Invalid name. Letters only, min 2 characters.\nEnter your full name:`
    } else {
      response = `CON Enter your location:`
      await updateSession(sessionId, 'enter_location', {
        action: 'register',
        name: userInput
      })
    }

  // Option 4 - Save registration
  } else if (textArray.length === 3 && textArray[0] === '4') {
    if (!isValidLocation(userInput)) {
      response = `CON Invalid location. Min 2 characters.\nEnter your location:`
    } else {
      const name = textArray[1].trim()
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
        response = `END Registration successful!\nName: ${name}\nLocation: ${location}\n\nWelcome to Agri-D Ledger!`
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