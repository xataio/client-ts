import { Schema } from '../packages/client/src/api/schemas';
import schemaJson from '../packages/codegen/example/schema.json';
import { PgRollOperation } from '../packages/pgroll';

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

export const pgRollMigrations: PgRollOperation[] = [
  {
    create_table: {
      name: 'users',
      columns: [
        { name: 'email', type: 'text', unique: true, nullable: true },
        { name: 'name', type: 'text', nullable: true },
        { name: 'photo', type: 'xata.xata_file', nullable: true, comment: `{ "xata.file.dpa": true }` },
        { name: 'attachments', type: 'xata.xata_file_array', nullable: true },
        { name: 'plan', type: 'text', nullable: true },
        { name: 'dark', type: 'boolean', nullable: true },
        { name: 'full_name', type: 'text', nullable: false, default: "'John Doe'" },
        { name: 'index', type: 'int8', nullable: true },
        { name: 'rating', type: 'float', nullable: true },
        { name: 'birthDate', type: 'timestamptz', nullable: true },
        { name: 'street', type: 'text', nullable: true },
        { name: 'zipcode', type: 'int', nullable: true },
        { name: 'account_value', type: 'int', nullable: true },
        { name: 'vector', type: 'real[]', nullable: true, comment: `{ "xata.search.dimension": 4 }` }
      ]
    }
  },
  {
    create_table: {
      name: 'teams',
      columns: [
        { name: 'name', type: 'text', nullable: true },
        { name: 'description', type: 'text', nullable: true },
        { name: 'labels', type: 'text[]', nullable: true },
        { name: 'index', type: 'int', nullable: true },
        { name: 'rating', type: 'float', nullable: true },
        { name: 'founded_date', type: 'timestamptz', nullable: true },
        { name: 'email', type: 'text', nullable: true },
        { name: 'plan', type: 'text', nullable: true },
        { name: 'dark', type: 'boolean', nullable: true },
        { name: 'config', type: 'jsonb', nullable: true }
      ]
    }
  },
  {
    create_table: {
      name: 'pets',
      columns: [
        { name: 'name', type: 'text', nullable: true },
        { name: 'type', type: 'text', nullable: true },
        { name: 'num_legs', type: 'int', nullable: true }
      ]
    }
  },
  {
    add_column: {
      table: 'users',
      column: {
        name: 'team',
        type: 'text',
        nullable: true,
        comment: `{ "xata.link": "teams" }`,
        references: { name: 'fk_team_id', table: 'teams', column: 'xata_id' }
      }
    }
  },
  {
    add_column: {
      table: 'users',
      column: {
        name: 'pet',
        type: 'text',
        nullable: true,
        comment: `{ "xata.link": "pets" }`,
        references: { name: 'fk_pet_id', table: 'pets', column: 'xata_id' }
      }
    }
  },
  {
    add_column: {
      table: 'teams',
      column: {
        name: 'owner',
        type: 'text',
        nullable: true,
        comment: `{ "xata.link": "users" }`,
        references: { name: 'fk_owner_id', table: 'users', column: 'xata_id' }
      }
    }
  }
];
