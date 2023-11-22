import { buildClient } from '@xata.io/client';
import type { BaseClientOptions, SchemaInference, XataRecord } from '@xata.io/client';

export const tables = [
  {
    name: 'users',
    columns: [
      { name: 'name', type: 'string', notNull: true, defaultValue: '' },
      { name: 'verified', type: 'bool', notNull: true, defaultValue: 'false' },
      { name: 'jsonb', type: 'json' },
      {
        name: 'created_at',
        type: 'datetime',
        notNull: true,
        defaultValue: 'now'
      }
    ]
  },
  {
    name: 'cities',
    columns: [
      { name: 'name', type: 'string', notNull: true, defaultValue: '' },
      { name: 'state', type: 'string' }
    ],
    revLinks: [{ column: 'city_id', table: 'users2' }]
  },
  {
    name: 'users2',
    columns: [
      { name: 'name', type: 'string', notNull: true, defaultValue: '' },
      { name: 'city_id', type: 'link', link: { table: 'cities' } }
    ]
  },
  {
    name: 'courses',
    columns: [
      { name: 'name', type: 'string', notNull: true, defaultValue: '' },
      {
        name: 'category_id',
        type: 'link',
        link: { table: 'course_categories' }
      }
    ]
  },
  {
    name: 'course_categories',
    columns: [{ name: 'name', type: 'string', defaultValue: '' }],
    revLinks: [{ column: 'category_id', table: 'courses' }]
  },
  {
    name: 'orders',
    columns: [
      { name: 'region', type: 'string', notNull: true, defaultValue: '' },
      { name: 'product', type: 'string', notNull: true, defaultValue: '' },
      { name: 'amount', type: 'int', notNull: true, defaultValue: '0' },
      { name: 'quantity', type: 'int', notNull: true, defaultValue: '0' }
    ]
  },
  {
    name: 'network_table',
    columns: [
      { name: 'inet', type: 'string', notNull: true, defaultValue: '' },
      { name: 'cidr', type: 'string', notNull: true, defaultValue: '' },
      { name: 'macaddr', type: 'string', notNull: true, defaultValue: '' },
      { name: 'macaddr8', type: 'string', notNull: true, defaultValue: '' }
    ]
  },
  {
    name: 'sal_emp',
    columns: [
      { name: 'name', type: 'string' },
      { name: 'pay_by_quarter', type: 'multiple' },
      { name: 'schedule', type: 'multiple' }
    ]
  },
  { name: 'tictactoe', columns: [{ name: 'squares', type: 'json' }] },
  {
    name: 'users12',
    columns: [
      { name: 'name', type: 'string', notNull: true, defaultValue: '' },
      { name: 'email', type: 'email' }
    ]
  }
] as const;

export type SchemaTables = typeof tables;
export type InferredTypes = SchemaInference<SchemaTables>;

export type Users = InferredTypes['users'];
export type UsersRecord = Users & XataRecord;

export type Cities = InferredTypes['cities'];
export type CitiesRecord = Cities & XataRecord;

export type Users2 = InferredTypes['users2'];
export type Users2Record = Users2 & XataRecord;

export type Courses = InferredTypes['courses'];
export type CoursesRecord = Courses & XataRecord;

export type CourseCategories = InferredTypes['course_categories'];
export type CourseCategoriesRecord = CourseCategories & XataRecord;

export type Orders = InferredTypes['orders'];
export type OrdersRecord = Orders & XataRecord;

export type NetworkTable = InferredTypes['network_table'];
export type NetworkTableRecord = NetworkTable & XataRecord;

export type SalEmp = InferredTypes['sal_emp'];
export type SalEmpRecord = SalEmp & XataRecord;

export type Tictactoe = InferredTypes['tictactoe'];
export type TictactoeRecord = Tictactoe & XataRecord;

export type Users12 = InferredTypes['users12'];
export type Users12Record = Users12 & XataRecord;

export type DatabaseSchema = {
  users: UsersRecord;
  cities: CitiesRecord;
  users2: Users2Record;
  courses: CoursesRecord;
  course_categories: CourseCategoriesRecord;
  orders: OrdersRecord;
  network_table: NetworkTableRecord;
  sal_emp: SalEmpRecord;
  tictactoe: TictactoeRecord;
  users12: Users12Record;
};

const DatabaseClient = buildClient();

const defaultOptions = {};

export class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions) {
    super({ ...defaultOptions, ...options }, tables);
  }
}

let instance: XataClient | undefined = undefined;

export const getXataClient = () => {
  if (instance) return instance;

  instance = new XataClient();
  return instance;
};
