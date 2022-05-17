import { Column } from '../packages/client/src/api/schemas';

const animals = [
  'Ape',
  'Butterfly',
  'Cat',
  'Crocodile',
  'Dog',
  'Koala',
  'Monkey',
  'Penguin',
  'Pig',
  'Scorpion',
  'Shark',
  'Whale',
  'Wolverine',
  'Wombat',
  'Zebra'
];

const fruits = [
  'Apple',
  'Banana',
  'Cherry',
  'Fig',
  'Grape',
  'Lemon',
  'Orange',
  'Papaya',
  'Peach',
  'Pear',
  'Pineapple',
  'Pomelo',
  'Strawberry',
  'Watermelon'
];

const ownerFruits = {
  full_name: 'Owner of team fruits',
  email: 'owner.fruits@example.com',
  address: {
    street: 'Main Street',
    zipcode: 100
  }
};

const ownerAnimals = {
  full_name: 'Owner of team animals',
  email: 'owner.animals@example.com',
  address: {
    street: 'Elm Street',
    zipcode: 200
  }
};

const animalUsers = animals.map((animal) => ({
  full_name: animal,
  email: `${animal.toLowerCase().replace(' ', '_')}@zoo.example.com`,
  address: {
    street: 'Zoo Plaza',
    zipcode: 200
  }
}));

const fruitUsers = fruits.map((fruit) => ({
  full_name: fruit,
  email: `${fruit.toLowerCase().replace(' ', '_')}@macedonia.example.com`,
  address: {
    street: 'Grocery Street',
    zipcode: 200
  }
}));

export const mockUsers = [ownerFruits, ownerAnimals, ...animalUsers, ...fruitUsers];

export const userColumns: Column[] = [
  {
    name: 'email',
    type: 'email'
  },
  {
    name: 'full_name',
    type: 'string'
  },
  {
    name: 'address',
    type: 'object',
    columns: [
      {
        name: 'street',
        type: 'string'
      },
      {
        name: 'zipcode',
        type: 'int'
      }
    ]
  },
  {
    name: 'team',
    type: 'link',
    link: {
      table: 'teams'
    }
  }
];

export const teamColumns: Column[] = [
  {
    name: 'name',
    type: 'string'
  },
  {
    name: 'labels',
    type: 'multiple'
  },
  {
    name: 'owner',
    type: 'link',
    link: {
      table: 'users'
    }
  }
];
