<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

use WebSanity\FormSanity\Markup\Parser;
use WebSanity\FormSanity\Validation\Validator;

/** The public face of the library: one parsed form, and the judgment it passes on a submission. */
final class Form
{
	private function __construct(private readonly Model\Form $model)
	{
	}

	public static function parse(string $html): self
	{
		return new self(Parser::parse($html));
	}

	/**
	 * @param array<array-key, mixed> $payload the decoded JSON body, or the form parts of a multipart body
	 * @param array<array-key, mixed> $files the upload entries, in the shape of `$_FILES`
	 * @param ?callable(string, string): bool $unique answers whether the value of the named field is still free
	 * @param list<string> $extras the payload keys a host injects, which are known without being authored
	 */
	public function validate(array $payload, array $files = [], ?callable $unique = null, Unknown $unknown = Unknown::Ignore, array $extras = []): Result
	{
		return Validator::validate($this->model, $payload, $files, $unique, $unknown, $extras);
	}
}
