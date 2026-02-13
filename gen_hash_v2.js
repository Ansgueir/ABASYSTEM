const bcrypt = require('bcryptjs');
console.log('HASH_START:' + bcrypt.hashSync('123456', 10) + ':HASH_END');