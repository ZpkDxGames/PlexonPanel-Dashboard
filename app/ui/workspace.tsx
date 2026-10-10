"use client";
import './workspace.css';
import { record, str } from '../../lib/control-state';
import { Children, Component, isValidElement, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Badge as CoreBadge, Button as CoreButton, Panel as CorePanel, Select as CoreSelect, EmptyState, Icon, Popover, type Tone } from './primitives';

export function PageHeader({title, description, primary, secondary}: {title: string; description: ReactNode; primary?: ReactNode; secondary?: ReactNode}) {
  return <header className="pp-page-header"><div><h2>{title}</h2><p className="pp-muted">{description}</p></div><div className="pp-row">{secondary}{primary}</div></header>;
}
export function SourceFacts({source,unit,capturedAt,receivedAt}: {source:string;unit:string;capturedAt?:unknown;receivedAt?:number}) {
  const captured=typeof capturedAt==='string'||typeof capturedAt==='number'?new Date(capturedAt):null;
  return <dl className="pp-facts"><div><dt>Source / unit</dt><dd>{source} / {unit}</dd></div><div><dt>Captured at</dt><dd>{captured&&Number.isFinite(captured.getTime())?captured.toISOString():'Not supplied to this view'}</dd></div><div><dt>Latest browser packet received at</dt><dd>{receivedAt?new Date(receivedAt).toISOString():'Not supplied'}</dd></div></dl>;
}
export function DisabledReason({reason}: {reason?: string}) {
  if (!reason) return null;
  return <span className="pp-disabled-reason"><span>{reason}</span><Popover label={<Icon name="info" size="small"/>} accessibleLabel="Why is this unavailable?" title="Action unavailable"><p>{reason}</p></Popover></span>;
}
export function Button({disabledReason, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary'|'secondary'|'quiet'|'danger'; busy?: boolean; disabledReason?: string}) {
  return <span className="pp-action-control"><CoreButton {...props}/>{props.disabled && !props.busy && <DisabledReason reason={disabledReason || 'Not available right now'}/>}</span>;
}
export function Badge({tone='quiet', children}: {tone?: string; children: ReactNode}) {
  const tones: Record<string,Tone>={green:'ok',amber:'warn',red:'critical',blue:'info',cyan:'info',quiet:'unknown',ok:'ok',warn:'warn',critical:'critical',info:'info',unknown:'unknown'};
  return <CoreBadge tone={tones[tone]??'unknown'}>{children}</CoreBadge>;
}
export function Panel({title, aside, children, className}: {title: string; aside?: ReactNode; children: ReactNode; className?: string}) {
  return <CorePanel title={title} actions={aside} className={className}>{children}</CorePanel>;
}
export function Empty({title, children}: {title: string; children?: ReactNode}) {
  return <EmptyState title={title}>{children ?? 'Adjust the filters or wait for the next authorized snapshot.'}</EmptyState>;
}
export function ActionButton({children,onClick,danger=false,disabled=false,disabledReason,variant,pendingLabel='Waiting for signed result…'}: {pendingLabel?:string;variant?:'primary'|'secondary'|'quiet'|'danger';children: ReactNode;onClick:()=>Promise<unknown>;danger?:boolean;disabled?:boolean;disabledReason?:string}) {
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState('');
  return <span className="pp-action-control"><Button variant={variant??(danger?'danger':'secondary')} disabled={disabled} disabledReason={disabledReason} busy={busy} onClick={event=>{const button=event.currentTarget;document.querySelector('[data-action-return-focus]')?.removeAttribute('data-action-return-focus');button.setAttribute('data-action-return-focus','');setBusy(true);setResult('');void onClick().then(response=>{const result=record(response);setResult(str(record(result.data).message,str(result.message,'')));}).catch(error=>{if(error?.message!=='Cancelled')setResult(error instanceof Error?error.message:'Operation failed.');}).finally(()=>{button.removeAttribute('data-action-return-focus');setBusy(false);});}}>{busy?pendingLabel:children}</Button>{result&&<span role="status" className="pp-muted">{result}</span>}</span>;
}
/** Presentation adapter for existing option children; selection and gates stay at the caller. */
export function Select({children,value,onValueChange,disabled,'aria-label':label}: {children:ReactNode;value?:string|number|readonly string[];onValueChange:(value:string)=>void;disabled?:boolean;'aria-label'?:string}) {
  const options: {value:string;label:string;disabled?:boolean}[]=[];
  const visit=(nodes:ReactNode)=>Children.forEach(nodes,node=>{if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean}>(node))return;if(node.type==='option'){const text=Children.toArray(node.props.children).join('');options.push({value:String(node.props.value??text),label:text,disabled:node.props.disabled});}else visit(node.props.children);});
  visit(children);
  return <CoreSelect label={label??'Selection'} value={String(value??'')} options={options} disabled={disabled} onChange={onValueChange}/>;
}
export class WorkspaceBoundary extends Component<{name:string;children:ReactNode},{failed:boolean;revision:number}> {
  state={failed:false,revision:0};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<section className="pp-workspace pp-prose"><EmptyState title={`${this.props.name} could not open`} action={<CoreButton onClick={()=>this.setState(s=>({failed:false,revision:s.revision+1}))}>Try again</CoreButton>}>Try opening this workspace again. Signed operations keep their existing server target.</EmptyState></section>:<div key={this.state.revision}>{this.props.children}</div>;}
}
