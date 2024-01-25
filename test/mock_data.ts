import { Schema } from '../packages/client/src/api/schemas';
import schemaJson from '../packages/codegen/example/schema.json';

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

export const ownerFruits = {
  full_name: 'Owner of team fruits',
  email: 'owner.fruits@example.com',
  street: 'Main Street',
  zipcode: 100
};

export const ownerAnimals = {
  full_name: 'Owner of team animals',
  email: 'owner.animals@example.com',
  street: 'Elm Street',
  zipcode: 200
};

export const animalUsers = animals.map((animal) => ({
  full_name: animal,
  email: `${animal.toLowerCase().replace(' ', '_')}@zoo.example.com`,
  street: 'Zoo Plaza',
  zipcode: 200
}));

export const fruitUsers = fruits.map((fruit) => ({
  full_name: fruit,
  email: `${fruit.toLowerCase().replace(' ', '_')}@macedonia.example.com`,
  street: 'Grocery Street',
  zipcode: 200
}));

export const mockUsers = [ownerFruits, ownerAnimals, ...animalUsers, ...fruitUsers];

export const schema = schemaJson as Schema;
