# AI Policy

In this document, "AI" refers to generative AI tools, such as large language
models (LLMs). These tools can write, edit, and review code, make images, or
write text that reads like human communication.

This policy applies to all contributors, maintainers included. It applies to
all parts of this repository: the core crate, the Python and WebAssembly
bindings, the website, and the documentation.

## Responsibility

You are responsible for all the code that you submit to gdock. This is true
for code that you wrote and for code that an AI tool generated.

You must understand the code that you submit, and the related code that is
already in gdock. You must be able to explain your contribution without the
help of an AI tool. We do not accept a patch that its author cannot explain.

## Human-Written Majority

gdock is hosted on [Codeberg](https://codeberg.org/rvhonorato/gdock). The
[Codeberg Terms of Use](https://codeberg.org/Codeberg/org/src/branch/main/TermsOfUse.md)
(§ 2 (1) 7) do not permit projects that mostly consist of AI-generated code.
The reasons are the unclear copyright status of such code and the few
safeguards against harmful code.

gdock obeys this rule, and we agree with these reasons. AI tools can help you
with a contribution, but they must not be its primary author. We reject pull
requests that are fully or mostly AI-generated.

## Disclosure

You must tell us in the pull request if you used AI to help you. If you did,
give this information:

- The tools that you used.
- How you used them.
- Which code or text is AI-generated.

We reject pull requests that do not include this disclosure.

## Code Quality

gdock is scientific software. A change that looks correct can still give
incorrect docking results. Thus, we expect each contribution to include tests
and to pass the checks in [CONTRIBUTING.md](CONTRIBUTING.md).

We reject pull requests that we consider to be "AI slop". Do not use the time
of the maintainers to review code that you did not examine first.

## Copyright

All code in gdock is released under the
[BSD Zero Clause License](LICENSE) (0BSD). When you contribute, you release
your code under the same license. Thus, you must have the right to release
all the code that you submit under 0BSD.

AI-generated code can infringe copyright. It is your responsibility to make
sure that your contribution does not. We can reject any pull request,
AI-generated or not, if its copyright status is not clear.

## Communication

Do not let AI speak for you when you communicate with the maintainers. This
applies to issues, pull request descriptions, review replies, and discussions.
Write them yourself.

You can use AI for translation or to correct grammar. Human-to-human
communication is necessary for an open source community.

## AI Agents

An AI agent must not open issues or pull requests, and must not post comments,
without a human in control. A human must examine all generated code and submit
the pull request, as the "Responsibility" section requires.

See [AGENTS.md](AGENTS.md) for the instructions that we give to AI agents.

## Enforcement

The maintainers make the final decision on whether a contribution obeys this
policy. If a contribution does not obey this policy, we close it and tell you
why. Repeated violations can result in a ban from the project.

## Other Resources

These resources are not part of this policy. They can help you understand the
problems that AI contributions cause:

- [LLVM AI Tool Use Policy](https://llvm.org/docs/AIToolPolicy.html)
- [melissawm/open-source-ai-contribution-policies](https://github.com/melissawm/open-source-ai-contribution-policies)
- [Community considerations around AI (Scientific Python)](https://blog.scientific-python.org/scientific-python/community-considerations-around-ai/)
- [Protecting our FLOSS commons from LLMs (Codeberg)](https://blog.codeberg.org/protecting-our-floss-commons-from-llms.html)

## Acknowledgements

This policy is based on the AI policy of
[pdb-tools](https://github.com/haddocking/pdb-tools/pull/193), which is based
on the NumPy and SciPy policies. It also follows the Codeberg Terms of Use.
