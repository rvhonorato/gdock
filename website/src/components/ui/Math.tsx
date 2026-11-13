import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathProps {
  children: string
  display?: boolean
}

export function Math({ children, display = false }: MathProps) {
  const html = katex.renderToString(children, {
    throwOnError: false,
    displayMode: display,
  })

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={display ? 'block text-center my-2' : 'inline'}
    />
  )
}
