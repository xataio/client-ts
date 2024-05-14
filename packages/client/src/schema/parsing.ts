import { log } from 'console';
import { FilterExpression } from '../api/dataPlaneSchemas';
import { isObject } from '../util/lang';

type FilterPredicate =
  | FilterType
  | {
      operator: string;
      value: string | number | boolean | null | string[] | number[] | boolean[] | Date;
      field: string;
    };
type FilterType = {
  AND?: FilterPredicate[];
  OR?: FilterPredicate[];
  NOT?: FilterPredicate[];
};
const filter: FilterType = {
  AND: [
    {
      field: 'name',
      operator: '=',
      value: 'a'
    },
    {
      NOT: [{ field: 'name', operator: '=', value: 'a' }]
    }
  ],
  OR: [
    {
      field: 'name',
      operator: 'like',
      value: 'a'
    },
    {
      field: 'age',
      operator: '>',
      value: 10
    }
  ],
  NOT: [
    {
      OR: [
        {
          field: 'name',
          operator: 'like',
          value: 'a'
        },
        {
          field: 'age',
          operator: '>',
          value: 10
        }
      ]
    }
  ]
};

const recurse = ({
  value,
  operator,
  latestFieldName,
  current,
  latestLogicalOperator
}: {
  value: FilterExpression | FilterPredicate;
  operator: string;
  current: FilterType;
  latestFieldName?: string;
  latestLogicalOperator?: string;
}): FilterType => {
  if (isObject(value)) {
    const keys = Object.keys(value);
    for (const key of keys) {
      // @ts-ignore
      const computedCurrent = () => {
        console.log('computing current', key);
        switch (key) {
          case '$not':
            if (!current.NOT) current.NOT = [];
            return current.NOT;
          default:
            return current;
        }
      };
      // TODO fix
      recurse({
        value: (value as any)[key],
        operator: mapOperator(key),
        latestFieldName: key.startsWith('$') ? latestFieldName : key,
        current: computedCurrent(),
        latestLogicalOperator: key.startsWith('$') ? key : latestLogicalOperator
      });
    }
  }

  if (Array.isArray(value)) {
    for (const v of value) {
      recurse({
        value: v,
        operator: mapOperator(v as string),
        latestFieldName,
        current,
        latestLogicalOperator: typeof v === 'string' && v.startsWith('$') ? v : latestLogicalOperator
      });
    }
  }

  if (!isObject(value) && !Array.isArray(value)) {
    if (latestLogicalOperator === '$not' || latestLogicalOperator === '$none') {
      if (!current.NOT) {
        current.NOT = [
          {
            field: latestFieldName ?? value,
            operator,
            value
          }
        ];
      } else {
        current.NOT?.push({
          field: latestFieldName ?? value,
          operator,
          value
        });
      }
      console.log('NOTTTTT after');
    } else if (latestLogicalOperator === '$any') {
      if (!current.OR) {
        current.OR = [
          {
            field: latestFieldName ?? value,
            operator,
            value
          }
        ];
      } else {
        current.OR?.push({
          field: latestFieldName ?? value,
          operator,
          value
        });
      }
      console.log('ORRRRR after', current.OR);
    } else {
      if (!current.AND) current.AND = [];
      current.AND?.push({
        field: latestFieldName ?? value,
        operator,
        value
      });
      console.log('after ANDDDD', current.OR);
    }
  }
  return current;
};
export const parseFilter = (value: FilterExpression | FilterPredicate): any => {
  const obj = {
    AND: [],
    OR: [],
    NOT: []
  };
  return recurse({ value, operator: 'equals', current: obj });
};

function mapOperator(
  key: string
):
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'in'
  | 'not in'
  | 'like'
  | 'not like'
  | 'ilike'
  | 'not ilike'
  | 'is'
  | 'is not'
  | 'any'
  | 'all'
  | 'none'
  | 'exists'
  | 'not exists'
  | 'not' {
  switch (key) {
    case '$is':
    case '$eq':
      return '=';
    case '$contains':
      return 'like';
    case '$ne':
      return '!=';
    case '$gt':
      return '>';
    case '$lt':
      return '<';
    case '$gte':
      return '>=';
    case '$lte':
      return '<=';
    case '$in':
    case '$includes':
      return 'in';
    case '$nin':
      return 'not in';
    case '$like':
      return 'like';
    case '$notLike':
      return 'not like';
    case '$ilike':
      return 'ilike';
    case '$notIlike':
      return 'not ilike';
    case '$any':
      return '=';
    case '$all':
      return '=';
    case '$none':
      return '!=';
    case '$exists':
      return 'exists';
    case '$notExists':
      return 'not exists';
  }
  return '=';
}
