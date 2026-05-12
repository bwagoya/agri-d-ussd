const supabase = require('../config/supabaseClient')

const handleUssd = async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body
  const textArray = text.split('*')
  const userInput = textArray[textArray.length - 1]
  let response = ''

  // Main menu
  if (text === '') {
    response = `CON Welcome to Agri-D Ledger\n1. List Produce\n2. Check My Listings\n3. View Prices\n4. Register`

  // Option 1 - List Produce
  } else if (text === '1') {
    response = `CON Select crop type:\n1. Maize\n2. Potatoes`

  // Option 1 - Crop selected
  } else if (text === '1*1' || text === '1*2') {
    const crops = { '1': 'Maize', '2': 'Potatoes' }
    const crop = crops[userInput]
    response = `CON ${crop} selected.\nEnter quantity (bags):`

  // Option 1 - Quantity entered
  } else if (textArray.length === 3 && textArray[0] === '1') {
    const quantity = textArray[2]
    if (isNaN(quantity) || quantity <= 0) {
      response = `CON Invalid quantity. Please enter a number:`
    } else {
      response = `CON Enter your asking price per bag (KES):`
    }

  // Option 1 - Price entered - show summary
  } else if (textArray.length === 4 && textArray[0] === '1') {
    const crops = { '1': 'Maize', '2': 'Potatoes' }
    const crop = crops[textArray[1]]
    const quantity = textArray[2]
    const price = textArray[3]
    if (isNaN(price) || price <= 0) {
      response = `CON Invalid price. Please enter a number:`
    } else {
      const total = quantity * price
      response = `CON Summary:\nCrop: ${crop}\nQty: ${quantity} bags\nPrice: KES ${price}/bag\nTotal: KES ${total}\n\n1. Confirm\n2. Cancel`
    }

// Option 1 - Confirm listing - save to Supabase
  } else if (textArray.length === 5 && textArray[0] === '1') {
    if (userInput === '1') {
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
        response = `END Listing submitted!\nRef: ${listingId}\n\nYou will receive an SMS when a buyer is found.`
      }

    } else {
      response = `END Listing cancelled.`
    }

  // Option 2 - Check My Listings
  } else if (text === '2') {
    const { data, error } = await supabase
      .from('produce_listings')
      .select('listing_id, crop_type, quantity, status')
      .eq('phone_number', phoneNumber)
      .limit(3)

    if (error || !data || data.length === 0) {
      response = `END You have no listings yet.`
    } else {
      let list = data.map(l => `${l.crop_type} - ${l.quantity} bags - ${l.status}`).join('\n')
      response = `END Your listings:\n${list}`
    }

  // Option 3 - View Prices
  } else if (text === '3') {
    response = `END Price checker coming soon.`

  // Option 4 - Register - enter name
  } else if (text === '4') {
    response = `CON Enter your name:`

  // Option 4 - Enter location
  } else if (textArray.length === 2 && textArray[0] === '4') {
    response = `CON Enter your location:`

  // Option 4 - Save registration to Supabase
  } else if (textArray.length === 3 && textArray[0] === '4') {
    const name = textArray[1]
    const location = textArray[2]

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
    }

  } else {
    response = `END Invalid option. Please try again.`
  }

  res.set('Content-Type', 'text/plain')
  res.send(response)
}

module.exports = { handleUssd }