import _ from 'lodash';
import { fft } from './fft.ts'

// This gives a standard way to get a value for a given field
export abstract class SeriesWrapper {
  refId: string; // From Query Target
  name: string;

  type?: 'string' | 'date' | 'boolean' | 'epoch' | 'number';
  first?: any;
  count: number;

  /** @ngInject */
  constructor(refId: string) {
    this.refId = refId;
  }

  protected setFirst(v: any) {
    this.first = v;
    if (_.isNumber(v)) {
      this.type = 'number';
    } else if (_.isString(v)) {
      this.type = 'string';
    } else if (typeof v === typeof true) {
      this.type = 'boolean';
    }
  }

  // The best key for this field
  getKey(): string {
    return this.name;
  }

  // All ways to access this field
  getAllKeys(): string[] {
    return [this.getKey()];
  }

  abstract toArray(): Array<string | number | boolean>;
}

export class SeriesWrapperSeries extends SeriesWrapper {
  value: 'value' | 'index' | 'time' | 'freq' | 'fft';

  /** @ngInject */
  constructor(refId: string, public series: any, val: 'value' | 'index' | 'time' | 'freq' | 'fft') {
    super(refId);
    this.value = val;
    this.count = series.datapoints.length;
    this.name = series.target;

    if ('index' === val) {
      this.first = 0;
      this.type = 'number';
      this.name += '@index';
      return;
    }
    if ('value' === val) {
      _.forEach(series.datapoints, arr => {
        if (arr[0] !== null) {
          // 0 is an ok value so cant use if(arr[0])
          this.setFirst(arr[0]);
          return false;
        }
        return true; // continue
      });
      return;
    }
    if ('time' === val) {
      this.type = 'epoch';
      this.first = series.datapoints[0][1];
      this.name += '@time';
      return;
    }
    if ('freq' === val) {
      this.first = 0;
      this.type = 'number';
      this.name += '@freq';
      return;
    }
    if ('fft' === val) {
      this.first = 0;
      this.type = 'number';
      this.name += '@fft';
      return;
    }
  }

  toArray(): any[] {
    if ('index' === this.value) {
      const arr = new Array(this.count);
      for (let i = 0; i < this.count; i++) {
        arr[i] = i;
      }
      return arr;
    }
    if ('time' === this.value) {
      return _.map(this.series.datapoints, arr => {
        return arr[1];
      });
    }
    if ('value' === this.value) {
      return _.map(this.series.datapoints, arr => {
        return arr[0];
      });
    }
    if ('freq' === this.value) {
      const arr = new Array(this.count);
      const df = 1.0/(this.series.datapoints[1][1]-this.series.datapoints[0][1])/this.count/2.0

      /* fftshift version */
      for (let i = 0; i < this.count; i++) {
        const idx = (i+Math.floor(this.count/2))%this.count;
        arr[idx] = (-Math.floor(this.count/2)+i)*df;
      }

      /* fft positive freq only version
      for (let i = 0; i < this.count/2; i++) {
        arr[i] = i*df
      }*/

      return arr;
    }
    if ('fft' === this.value) {
      let real = _.map(this.series.datapoints, arr => {
        return arr[0];
      });
      let complex = _.map(this.series.datapoints, arr => {
        return 0;
      });
      fft(real, complex);
      const arr = new Array(this.count);

      /* fftshift version */
      for (let i=0; i<this.count; i++) {
        arr[i] = Math.pow(real[i],2) + Math.pow(complex[i],2)
      }

      /* fft positive freq only version
      for (let i=0; i<this.count/2; i++) {
        arr[i] = Math.pow(real[i],2) + Math.pow(complex[i],2)
      }
      */
      return arr;
    }
    return [];
  }

  getAllKeys(): string[] {
    if (this.refId) {
      const vals = [this.name, this.refId + '@' + this.value, this.refId + '/' + this.name];

      if ('A' === this.refId) {
        vals.push('@' + this.value);
      }
      return vals;
    }
    return [this.name];
  }
}

export class SeriesWrapperTableRow extends SeriesWrapper {
  /** @ngInject */
  constructor(refId: string, public table: any) {
    super(refId);

    this.name = refId + '@row';
  }

  toArray(): any[] {
    const count = this.table.rows.length;
    const arr = new Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = i;
    }
    return arr;
  }
}

export class SeriesWrapperTable extends SeriesWrapper {
  /** @ngInject */
  constructor(refId: string, public table: any, public index: number) {
    super(refId);
    this.count = table.rows.length;

    const col = table.columns[index];
    if (!col) {
      throw new Error('Unkonwn Column: ' + index);
    }

    this.name = col.text;
    if ('time' === col.type) {
      this.type = 'epoch';
      this.first = table.rows[0][index];
    } else {
      for (let i = 0; i < this.count; i++) {
        const v = table.rows[i][index];
        if (v !== null) {
          // 0 is an ok value so cant use if(v)
          this.setFirst(v);
          return;
        }
      }
    }
  }

  toArray(): any[] {
    return _.map(this.table.rows, row => {
      return row[this.index];
    });
  }

  getAllKeys(): string[] {
    if (this.refId) {
      return [this.getKey(), this.refId + '/' + this.name, this.refId + '[' + this.index + ']'];
    }
    return [this.getKey()];
  }
}
