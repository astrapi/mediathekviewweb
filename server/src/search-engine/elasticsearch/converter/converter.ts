
import { QueryBody, SearchQuery } from '../../../common/search-engine/query';
import { ConvertHandler } from './convert-handler';
import { SortConverter } from './handlers';
import { RequestParams } from '@elastic/elasticsearch';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 250;

export class Converter {
  private readonly handlers: ConvertHandler[];
  private readonly sortConverter: SortConverter;

  constructor(sortConverter: SortConverter) {
    this.handlers = [];
    this.sortConverter = sortConverter;
  }

  registerHandler(...handlers: ConvertHandler[]): void {
    this.handlers.push(...handlers);
  }

  convert(query: SearchQuery, index: string): RequestParams.Search {
    if ((query.skip != undefined) && (query.cursor != undefined)) {
      throw new Error('cursor and skip cannot be used at the same time');
    }

    const from = (query.skip != undefined) ? query.skip : undefined;
    const search_after = (query.cursor != undefined) ? JSON.parse(query.cursor) : undefined; // tslint:disable-line: variable-name
    const size = (query.limit != undefined) ? query.limit : DEFAULT_LIMIT;

    if (size > MAX_LIMIT) {
      throw new Error(`Limit of ${query.limit} is above maximum allowed (${MAX_LIMIT})`);
    }

    const queryBody = this.convertBody(query.body, index);

    const elasticQuery: RequestParams.Search = {
      index,
      from,
      size,
      body: {
        query: queryBody,
        search_after,
        sort: this.getSort(query)
      }
    };

    return elasticQuery;
  }

  convertBody(queryBody: QueryBody, index: string): object {
    for (const handler of this.handlers) {
      const converted = handler.tryConvert(queryBody, index);

      if (converted.success) {
        return converted.result;
      }
    }

    throw new Error('not suitable handler for query available');
  }

  private getSort(query: SearchQuery): object {
    const querySort = (query.sort == undefined) ? [] : query.sort;
    return querySort.map((sort) => this.sortConverter.convert(sort));
  }
}
