<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Payload\MalformedBody;
use WebSanity\FormSanity\Validation\Validator;

/** The public face of the library: one parsed form, and the judgment it passes on a submission. */
final class Form
{
	/** The server's own code for a request body the submission protocol does not describe. */
	private const string MALFORMED_CODE = 'x-malformed-body';

	/** The prose that travels with the malformed-body code, which an `x-` code must carry. */
	private const string MALFORMED_MESSAGE = 'A JSON body cannot carry a file field.';

	private function __construct(private readonly Model\Form $model)
	{
	}

	public static function parse(string $html): self
	{
		return new self(Parser::parse($html));
	}

	/** The authored field names, as a list of strings in document order. @return list<string> */
	public function fieldNames(): array
	{
		return array_map(strval(...), array_keys($this->model->fields));
	}

	/**
	 * @param array<array-key, mixed> $payload the decoded JSON body, or the form parts of a multipart body
	 * @param array<array-key, mixed> $files the upload entries, in the shape of `$_FILES`
	 * @param ?callable(string, string): bool $unique answers whether the value of the named field is still free
	 * @param list<string> $extras the payload keys a host injects, which are known without being authored
	 */
	public function validate(array $payload, array $files = [], ?callable $unique = null, Unknown $unknown = Unknown::Ignore, array $extras = []): Result
	{
		try {
			return Validator::validate($this->model, $payload, $files, $unique, $unknown, $extras);
		} catch (MalformedBody) {
			// A body this protocol does not describe is a failed submission, not an exception for the host to handle.
			return (new Result([]))->withError(null, self::MALFORMED_CODE, self::MALFORMED_MESSAGE);
		}
	}
}
